import { expect, test, type Page } from "@playwright/test";

// Jurnalul vehiculului: reviziile și reparațiile nu se cer dinainte la
// configurare, ci se trec în ziua în care apar și rămân în jurnal. La mașină și
// scuter, kilometrajul dă alerta de revizie; la bicicletă nu se cer kilometri.

async function createAccount(page: Page, email: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Creează cont gratuit" }).first().click();
  await page.getByLabel("Adresă de email").fill(email);
  await page.getByLabel("Parolă", { exact: true }).fill("profitexact123");
  await page.getByLabel("Confirmă parola").fill("profitexact123");
  await page.getByRole("button", { name: "Creează contul" }).click();
  await page.getByLabel("Cod primit pe email").fill("123456");
  await page.getByRole("button", { name: "Verifică emailul" }).click();
}

const next = (page: Page) => page.getByRole("button", { name: "Continuă" }).click();

/** Ora României, la prânz, ca data să nu sară din cauza fusului orar. */
const day = (date: string) => new Date(`${date}T12:00:00+03:00`);

async function fillRideDay(page: Page, date: string, kilometers: string) {
  await page.locator("#work-date").fill(date);
  await page.getByLabel("Plăți pentru curse în aplicație").fill("400");
  await page.getByLabel("Comision Bolt").fill("80");
  await page.getByLabel("Kilometri parcurși").fill(kilometers);
  await page.getByLabel(/Prețul din ziua respectivă/).fill("7");
}

async function resultValue(page: Page) {
  const text = (await page.locator(".result-value").textContent()) ?? "";
  return Number(text.replace(/[^\d,-]/g, "").replace(",", "."));
}

test("mașina: kilometrajul dă alerta de revizie, iar revizia trecută în jurnal o resetează", async ({ page }) => {
  await page.clock.setFixedTime(day("2026-10-10"));
  await createAccount(page, "jurnal-masina@profitexact.test");
  await next(page);
  await next(page);
  await next(page);
  await page.getByLabel("Orașul principal în care lucrezi").fill("Pitesti");
  await next(page);
  await next(page);
  await page.getByLabel("Valoare comision").fill("10");
  await next(page);

  // Nicio sumă de service cerută dinainte, doar kilometrajul și revizia.
  await expect(page.getByText(/intervențiile la/)).toHaveCount(0);
  await page.getByLabel("Consum aproximativ").fill("8");
  await page.getByLabel("Kilometrajul mașinii acum").fill("187400");
  await page.getByLabel("Ultima revizie, la kilometrajul").fill("175000");
  await page.getByLabel("Revizie la fiecare").fill("15000");
  await next(page);
  await expect(page.getByText("187.400 km · revizie la 15.000 km")).toBeVisible();
  await page.getByRole("button", { name: "Confirmă configurația" }).click();

  const journal = page.getByRole("region", { name: "Cartea de service a mașinii" });
  await expect(journal.getByText("190.000 km")).toBeVisible();
  await expect(journal.getByText("Mai ai 2.600 km")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Revizia" })).toHaveCount(0);

  // O zi de lucru adaugă kilometrii ei la kilometraj.
  await page.clock.setFixedTime(day("2026-10-12"));
  await fillRideDay(page, "2026-10-11", "180");
  await page.getByRole("button", { name: "Salvează ziua în săptămână" }).click();
  await expect(journal.getByText("187.580 km")).toBeVisible();

  // Kilometrajul de la bord (cu drumurile personale) corectează estimarea: alerta devine roșie.
  await fillRideDay(page, "2026-10-12", "150");
  await page.getByLabel("Kilometraj la bord (opțional)").fill("188700");
  await page.getByRole("button", { name: "Salvează ziua în săptămână" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "Revizia se apropie" });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("Urmează revizia la 190.000 km: mai ai 1.300 km.");

  // Revizia făcută: costul scade din ziua respectivă și resetează contorul.
  await page.clock.setFixedTime(day("2026-10-14"));
  await fillRideDay(page, "2026-10-14", "60");
  await page.getByLabel("Kilometraj la bord (opțional)").fill("190100");
  const before = await resultValue(page);
  await page.getByLabel(/Ai avut o intervenție la mașină azi\?/).check();
  await page.getByLabel("Tip intervenție").selectOption("revizie");
  await page.getByLabel("Cost intervenție").fill("650");
  await page.getByLabel("Ce s-a făcut (opțional)").fill("ulei și filtre");
  await expect.poll(() => resultValue(page)).toBeCloseTo(before - 650, 2);
  await page.getByRole("button", { name: "Salvează ziua în săptămână" }).click();

  await expect(alert).toHaveCount(0);
  await expect(journal.getByText("205.100 km")).toBeVisible();
  const entry = journal.getByRole("listitem").first();
  await expect(entry).toContainText("Revizie");
  await expect(entry).toContainText("ulei și filtre");
  await expect(entry).toContainText("14.10.2026 · 190.100 km");
  await expect(entry).toContainText("650,00 RON");

  // Jurnalul rămâne salvat.
  await page.reload();
  await page.getByRole("button", { name: "Continuă de unde ai rămas" }).click();
  await expect(page.getByRole("region", { name: "Cartea de service a mașinii" }).getByText("ulei și filtre")).toBeVisible();
});

test("mașina închiriată: tot jurnal cu kilometraj, fără costuri de service dinainte", async ({ page }) => {
  await createAccount(page, "jurnal-chirie@profitexact.test");
  await next(page);
  await next(page);
  await next(page);
  await page.getByLabel("Orașul principal în care lucrezi").fill("Pitesti");
  await next(page);
  await page.getByRole("button", { name: /^Mașină închiriată/ }).click();
  await next(page);
  await page.getByLabel("Valoare comision").fill("10");
  await next(page);

  await expect(page.getByText(/intervențiile la/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Kilometraj și revizie" })).toBeVisible();
  await expect(page.getByText(/firma de închiriere/)).toBeVisible();
});

test("bicicleta: jurnal de reparații, fără niciun kilometraj", async ({ page }) => {
  await createAccount(page, "jurnal-bicicleta@profitexact.test");
  await page.getByRole("button", { name: /^Delivery/ }).click();
  await next(page);
  await next(page);
  await page.getByRole("button", { name: /^Wolt/ }).click();
  await next(page);
  await page.getByLabel("Orașul principal în care lucrezi").fill("Cluj-Napoca");
  await next(page);
  await page.getByRole("button", { name: /^Bicicletă Fără combustibil/ }).click();
  await next(page);
  await page.getByLabel("Valoare comision").fill("10");
  await next(page);

  await expect(page.getByText(/Kilometraj/)).toHaveCount(0);
  await expect(page.getByText(/intervențiile la/)).toHaveCount(0);
  await next(page);
  await expect(page.getByText(/Kilometraj/)).toHaveCount(0);
  await page.getByRole("button", { name: "Confirmă configurația" }).click();

  await expect(page.getByLabel(/Kilometraj la bord/)).toHaveCount(0);
  const journal = page.getByRole("region", { name: "Reparațiile bicicletei" });
  await expect(journal).toContainText("Nicio intervenție încă");
  await expect(journal.getByText(/Următoarea revizie|Kilometraj/)).toHaveCount(0);

  await page.getByRole("group", { name: "Wolt", exact: true }).getByLabel("Câștiguri fără bacșiș").fill("200");
  const before = await resultValue(page);
  await page.getByLabel(/Ai avut o intervenție la bicicletă azi\?/).check();
  await page.getByLabel("Tip intervenție").selectOption("reparatie");
  await page.getByLabel("Cost intervenție").fill("45");
  await page.getByLabel("Ce s-a făcut (opțional)").fill("cameră spate");
  await expect(page.getByText(/kilometrajul la bord/)).toHaveCount(0);
  await expect.poll(() => resultValue(page)).toBeCloseTo(before - 45, 2);
  await page.getByRole("button", { name: "Salvează ziua în săptămână" }).click();

  const entry = journal.getByRole("listitem").first();
  await expect(entry).toContainText("Reparație");
  await expect(entry).toContainText("cameră spate");
  await expect(entry).toContainText("45,00 RON");
  await expect(entry).not.toContainText("km");
});
