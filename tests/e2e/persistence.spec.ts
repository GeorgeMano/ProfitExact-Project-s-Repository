import { expect, test, type Page } from "@playwright/test";

/**
 * Verifică promisiunea centrală a salvării de test: în modul de depanare local
 * (codurile fixe 123456), contul, onboarding-ul și ziua salvată supraviețuiesc
 * reîncărcării paginii. Fără acest test, persistența este dovedită numai la
 * nivel de unități, nu și în aplicația reală.
 */

async function createDemoAccount(page: Page) {
  await page.getByRole("button", { name: "Creează cont gratuit" }).first().click();
  await page.getByLabel("Adresă de email").fill("sofer@profitexact.test");
  await page.getByLabel("Parolă", { exact: true }).fill("profitexact123");
  await page.getByLabel("Confirmă parola").fill("profitexact123");
  await page.getByRole("button", { name: "Creează contul" }).click();
  await page.getByLabel("Cod primit pe email").fill("123456");
  await page.getByRole("button", { name: "Verifică emailul" }).click();
}

async function completeOnboarding(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Ce tip de activitate faci?" }),
  ).toBeVisible();

  for (let step = 0; step < 3; step += 1) {
    await page.getByRole("button", { name: "Continuă" }).click();
  }

  await page.getByLabel("Orașul principal în care lucrezi").fill("Pitești");
  await page.getByRole("button", { name: "Continuă" }).click();
  await page.getByRole("button", { name: "Continuă" }).click();

  await page.getByLabel("Valoare comision").fill("10");
  await page.getByLabel("Plătești CIM/carte de muncă prin flotă?").check();
  await page.getByLabel("Cost pe săptămână").fill("900");
  await page.getByRole("button", { name: "Continuă" }).click();

  await page.getByLabel("Consum aproximativ").fill("8.5");
  await page.getByRole("button", { name: "Continuă" }).click();
  await page.getByRole("button", { name: "Confirmă configurația" }).click();

  await expect(
    page.getByRole("heading", { name: "Adaugă o zi de lucru" }),
  ).toBeVisible();
}

async function saveOneDay(page: Page) {
  await page.getByLabel("Plăți pentru curse în aplicație").fill("500");
  await page.getByLabel("Plăți pentru curse în numerar").fill("400");
  await page.getByLabel("Comision Bolt").fill("200");
  await page.getByLabel("Kilometri parcurși").fill("180");
  await page.getByLabel("Câte ore ai lucrat azi?").fill("8");
  await page.getByLabel("Prețul din ziua respectivă / litru").fill("7.2");
  await page.getByRole("button", { name: "Salvează ziua în săptămână" }).click();
  await expect(page.locator(".weekly-metrics")).toBeVisible();
}

test("onboarding-ul și ziua salvată supraviețuiesc reîncărcării", async ({ page }) => {
  await page.goto("/");
  await createDemoAccount(page);
  await completeOnboarding(page);
  await saveOneDay(page);

  // Starea dinaintea reîncărcării, ca să o putem compara exact.
  const weeklyBefore = await page.locator(".weekly-metrics").innerText();
  await expect(
    page.locator(".config-strip").getByText("Pitesti", { exact: true }),
  ).toBeVisible();

  await page.reload();

  // Prima pagină apare mereu, dar cu datele salvate oferă reluarea: un singur
  // clic duce înapoi în calculator, fără cont sau onboarding din nou.
  await expect(page.getByRole("heading", { name: /Știi cât încasezi/ })).toBeVisible();
  await page.getByRole("button", { name: "Continuă de unde ai rămas" }).click();
  await expect(
    page.getByRole("heading", { name: "Adaugă o zi de lucru" }),
  ).toBeVisible();
  await expect(
    page.locator(".config-strip").getByText("Pitesti", { exact: true }),
  ).toBeVisible();
  expect(await page.locator(".weekly-metrics").innerText()).toBe(weeklyBefore);
});

test("perioada introdusă manual supraviețuiește reîncărcării", async ({ page }) => {
  await page.goto("/");
  await createDemoAccount(page);
  await completeOnboarding(page);

  await page.getByRole("button", { name: "Săptămânal" }).click();
  await page.getByLabel("Alege o zi din săptămână").fill("2026-10-14");
  await expect(
    page.getByRole("heading", { name: /^Introdu totalul/ }),
  ).toBeVisible();

  await page.getByLabel("Plăți pentru curse în aplicație").fill("803.90");
  await page.getByLabel("Plăți pentru curse în numerar").fill("566.30");
  await page.getByLabel("Credite și promoții pentru utilizatori").fill("198.30");
  await page.getByLabel("Comision Bolt").fill("395.72");
  await page.getByLabel("Zile lucrate").fill("4");
  await page.getByLabel("Ore lucrate").fill("25");
  await page.getByLabel("Kilometri parcurși").fill("500");
  await page.getByLabel("Prețul pe litru folosit pentru perioadă").fill("9.78");
  await page.getByRole("button", { name: "Salvează săptămâna" }).click();
  await expect(page.getByRole("heading", { name: /introdus de tine/ })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Continuă de unde ai rămas" }).click();

  await page.getByRole("button", { name: "Săptămânal" }).click();
  await page.getByLabel("Alege o zi din săptămână").fill("2026-10-14");
  await expect(page.getByRole("heading", { name: /introdus de tine/ })).toBeVisible();
  await expect(page.getByLabel("Plăți pentru curse în aplicație")).toHaveValue("803.9");
  await expect(page.getByLabel("Credite și promoții pentru utilizatori")).toHaveValue("198.3");
  await expect(page.getByLabel("Comision Bolt")).toHaveValue("395.72");
});

test("butonul de ștergere readuce aplicația la prima pagină", async ({ page }) => {
  await page.goto("/");
  await createDemoAccount(page);
  await completeOnboarding(page);

  await page.getByRole("button", { name: "Șterge datele de test" }).click();
  await expect(page.getByRole("heading", { name: /Știi cât încasezi/ })).toBeVisible();

  // Ștergerea trebuie să fie definitivă, nu doar o schimbare de ecran.
  await page.reload();
  await expect(page.getByRole("heading", { name: /Știi cât încasezi/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuă de unde ai rămas" })).toHaveCount(0);
});

test("un cont verificat fără onboarding pornește tot de pe prima pagină", async ({ page }) => {
  await page.goto("/");
  await createDemoAccount(page);
  await expect(page.getByRole("heading", { name: "Ce tip de activitate faci?" })).toBeVisible();

  await page.reload();

  // Nu sare direct în onboarding: întâi prima pagină, apoi reluarea la cerere.
  await expect(page.getByRole("heading", { name: /Știi cât încasezi/ })).toBeVisible();
  await page.getByRole("button", { name: "Continuă de unde ai rămas" }).click();
  await expect(page.getByRole("heading", { name: "Ce tip de activitate faci?" })).toBeVisible();
});

test("înregistrarea neterminată se reia de la pasul codului", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Creează cont gratuit" }).first().click();
  await page.getByLabel("Adresă de email").fill("sofer@profitexact.test");
  await page.getByLabel("Parolă", { exact: true }).fill("profitexact123");
  await page.getByLabel("Confirmă parola").fill("profitexact123");
  await page.getByRole("button", { name: "Creează contul" }).click();
  await expect(page.getByRole("heading", { name: "Verifică emailul" })).toBeVisible();

  // Pleacă înainte să introducă codul de email.
  await page.reload();
  await expect(page.getByRole("heading", { name: /Știi cât încasezi/ })).toBeVisible();
  await page.getByRole("button", { name: "Continuă de unde ai rămas" }).click();
  await expect(page.getByRole("heading", { name: "Verifică emailul" })).toBeVisible();
  await expect(page.getByText("sofer@profitexact.test")).toBeVisible();

  await page.getByLabel("Cod primit pe email").fill("123456");
  await page.getByRole("button", { name: "Verifică emailul" }).click();

  // Fără pas de telefon: după email urmează direct onboarding-ul.
  await expect(page.getByRole("heading", { name: "Ce tip de activitate faci?" })).toBeVisible();
  await expect(page.getByText("Verifică telefonul")).toHaveCount(0);
});

test("„Creează cont” pornește de la zero chiar dacă există o înregistrare începută", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Creează cont gratuit" }).first().click();
  await page.getByLabel("Adresă de email").fill("sofer@profitexact.test");
  await page.getByLabel("Parolă", { exact: true }).fill("profitexact123");
  await page.getByLabel("Confirmă parola").fill("profitexact123");
  await page.getByRole("button", { name: "Creează contul" }).click();
  await expect(page.getByRole("heading", { name: "Verifică emailul" })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Creează cont gratuit" }).first().click();
  await expect(page.getByRole("heading", { name: "Creează contul" })).toBeVisible();
  await expect(page.getByLabel("Adresă de email")).toHaveValue("");
});
