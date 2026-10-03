import { expect, test } from "@playwright/test";
import { clickTopAction } from "./menu";

test("toate butoanele de creare cont deschid formularul", async ({ page }) => {
  await page.goto("/");
  await clickTopAction(page, /^Creează cont( gratuit)?$/);
  await expect(page.getByRole("heading", { name: "Creează contul" })).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Creează cont gratuit" }).first().click();
  await expect(page.getByRole("heading", { name: "Creează contul" })).toBeVisible();

  await page.goto("/");
  const finalButton = page.locator(".final-cta").getByRole("button", {
    name: "Creează cont gratuit",
  });
  await finalButton.scrollIntoViewIfNeeded();
  await finalButton.click();
  await expect(page.getByRole("heading", { name: "Creează contul" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test("formularul explică de ce un cont nu poate fi creat", async ({ page }) => {
  await page.goto("/");
  await clickTopAction(page, /^Creează cont( gratuit)?$/);
  await page.getByRole("button", { name: "Creează contul" }).click();
  await expect(page.locator(".account-error")).toHaveText(
    "Introdu o adresă de email validă.",
  );
});

test("parcurge onboarding-ul și actualizează rezultatul zilnic", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /Știi cât încasezi/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Creează cont gratuit" }).first().click();
  await page.getByLabel("Adresă de email").fill("sofer@profitexact.test");
  await page.getByLabel("Parolă", { exact: true }).fill("profitexact123");
  await page.getByLabel("Confirmă parola").fill("profitexact123");
  await page.getByRole("button", { name: "Creează contul" }).click();
  await expect(page.getByRole("heading", { name: "Verifică emailul" })).toBeVisible();
  await page.getByLabel("Cod primit pe email").fill("123456");
  await page.getByRole("button", { name: "Verifică emailul" }).click();

  await expect(
    page.getByRole("heading", { name: "Ce tip de activitate faci?" }),
  ).toBeVisible();

  for (let step = 0; step < 3; step += 1) {
    await page.getByRole("button", { name: "Continuă" }).click();
  }

  const cityInput = page.getByLabel("Orașul principal în care lucrezi");
  await expect(cityInput).toHaveAttribute("placeholder", "Ex. Bucuresti");
  await cityInput.fill("Pitești");
  await expect(cityInput).toHaveValue("Pitesti");

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
  await expect(page.getByText("Calculul nu este gata")).toBeVisible();
  await expect(page.locator(".config-strip").getByText("Pitesti", { exact: true })).toBeVisible();

  for (const label of [
    "Plăți pentru curse în aplicație",
    "Campanii",
    "Taxe de anulare",
    "Bacșiș în aplicație",
    "Plăți pentru curse în numerar",
    "Credite și promoții pentru utilizatori",
    "Costuri și taxe",
    "Comision Bolt",
    "Bacșiș numerar",
    "Curse private / alte încasări",
    "Kilometri parcurși",
    "Câte ore ai lucrat azi?",
    "Prețul din ziua respectivă / litru",
  ]) {
    await expect(page.getByLabel(label)).toHaveValue("");
  }

  await expect(page.getByRole("button", { name: "Salvează ziua în săptămână" })).toBeDisabled();
  await expect(page.locator(".weekly-metrics")).not.toBeVisible();

  await page.getByLabel("Plăți pentru curse în aplicație").fill("545");
  await page.getByLabel("Plăți pentru curse în numerar").fill("400");
  // Fără comisionul exact din aplicație ziua nu se calculează.
  await expect(page.getByRole("button", { name: "Salvează ziua în săptămână" })).toBeDisabled();
  await page.getByLabel("Comision Bolt").fill("200");
  await page.getByLabel("Bacșiș numerar").fill("15");
  // Totalurile se calculează ca în aplicație: 545 + 400 − 200 = 745.
  await expect(page.locator(".earnings-total")).toHaveText(/745,00 RON/);
  await expect(page.locator(".earnings-cash-pill").first()).toHaveText(/400,00 RON/);
  await expect(page.locator(".earnings-cash-pill.card")).toHaveText(/345,00 RON/);
  await page.getByLabel("Kilometri parcurși").fill("180");
  await page.getByLabel("Câte ore ai lucrat azi?").fill("8");
  await page.getByLabel("Prețul din ziua respectivă / litru").fill("7.2");
  await expect(page.getByText("Îți rămân azi")).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvează ziua în săptămână" })).toBeEnabled();

  await expect(page.getByLabel("Kilometri parcurși")).toHaveValue("180");
  await expect(page.getByLabel("Câte ore ai lucrat azi?")).toHaveValue("8");
  await expect(
    page.locator(".calculation-preview").getByText("110,16 RON", { exact: true }),
  ).toBeVisible();

  await page.getByLabel("Ai spălat mașina azi?").check();
  await page.getByLabel("Suma plătită la spălătorie").fill("20");

  // 745 + 15 − (110,16 combustibil + 74,50 flotă + 128,57 CIM + 20 spălare)
  await expect(page.locator(".result-value")).toHaveText("426,77 RON");
  // Flota primește 745 − 400 = 345, oprește 74,50 + 128,57.
  const dayFleet = page.locator(".fleet-card").first();
  await expect(dayFleet.getByRole("heading")).toHaveText("Flota îți datorează 141,93 RON.");
  await page.getByRole("button", { name: "Salvează ziua în săptămână" }).click();
  await expect(page.getByText("Regularizarea săptămânii")).toBeVisible();
  await expect(page.getByText("1", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Săptămânal" }).click();
  await expect(page.getByRole("heading", { name: "Centralizarea săptămânii" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Centralizare automată" })).toBeVisible();
  await expect(page.getByText("Datele nu sunt dublate.")).toBeVisible();

  await page.getByLabel("Alege o zi din săptămână").fill("2026-10-14");
  await expect(page.getByRole("heading", { name: /^Introdu totalul/ })).toBeVisible();
  await expect(page.getByLabel("Comision Bolt")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Salvează săptămâna" })).toBeDisabled();

  // Săptămâna reală din ecranul Bolt „Defalcarea câștigurilor”.
  await page.getByLabel("Plăți pentru curse în aplicație").fill("803.90");
  await page.getByLabel("Campanii").fill("9");
  await page.getByLabel("Taxe de anulare").fill("24");
  await page.getByLabel("Bacșiș în aplicație").fill("20");
  await page.getByLabel("Plăți pentru curse în numerar").fill("566.30");
  await page.getByLabel("Credite și promoții pentru utilizatori").fill("198.30");
  await page.getByLabel("Comision Bolt").fill("395.72");
  // Aceleași totaluri ca în aplicația Bolt.
  await expect(page.getByLabel("Venituri în aplicație")).toContainText("+856,90 RON");
  await expect(page.getByLabel("Venituri în numerar")).toContainText("+764,60 RON");
  await expect(page.locator(".earnings-total")).toHaveText(/1\.225,78 RON/);
  await expect(page.locator(".earnings-cash-pill").first()).toHaveText(/566,30 RON/);
  // Creditele și promoțiile se socotesc la card: 1.225,78 − 566,30.
  await expect(page.locator(".earnings-cash-pill.card")).toHaveText(/659,48 RON/);
  await page.getByLabel("Zile lucrate").fill("4");
  await page.getByLabel("Ore lucrate").fill("25");
  await page.getByLabel("Kilometri parcurși").fill("500");
  await page.getByLabel("Prețul pe litru folosit pentru perioadă").fill("9.78");
  await expect(page.locator(".calculation-preview").getByText("415,65 RON", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Salvează săptămâna" }).click();
  await expect(page.getByRole("heading", { name: /introdus de tine/ })).toBeVisible();
  // Flota: 1.225,78 − 566,30 = 659,48; − 122,58 comision; − 900 CIM ⇒ datorezi 363,10.
  const weekFleet = page.locator(".fleet-card");
  await expect(weekFleet.getByText("659,48 RON")).toBeVisible();
  await expect(weekFleet.getByText("122,58 RON")).toBeVisible();
  await expect(weekFleet.getByRole("heading")).toHaveText("Datorezi flotei 363,10 RON.");

  await page.getByRole("button", { name: "Lunar" }).click();
  await expect(page.getByRole("heading", { name: "Centralizarea lunii" })).toBeVisible();
  await expect(page.getByText(/1 săptămână introdusă ca total/)).toBeVisible();
  await expect(page.getByText("Săptămână · 12.10.2026–18.10.2026")).toBeVisible();
});

test("sumele se pot scrie cu virgulă, ca în România", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Creează cont gratuit" }).first().click();
  await page.getByLabel("Adresă de email").fill("virgula@profitexact.test");
  await page.getByLabel("Parolă", { exact: true }).fill("profitexact123");
  await page.getByLabel("Confirmă parola").fill("profitexact123");
  await page.getByRole("button", { name: "Creează contul" }).click();
  await page.getByLabel("Cod primit pe email").fill("123456");
  await page.getByRole("button", { name: "Verifică emailul" }).click();
  for (let step = 0; step < 3; step += 1) await page.getByRole("button", { name: "Continuă" }).click();
  await page.getByLabel("Orașul principal în care lucrezi").fill("Pitesti");
  await page.getByRole("button", { name: "Continuă" }).click();
  await page.getByRole("button", { name: "Continuă" }).click();
  await page.getByLabel("Valoare comision").fill("10");
  await page.getByRole("button", { name: "Continuă" }).click();
  await page.getByLabel("Consum aproximativ").pressSequentially("8,5");
  await page.getByRole("button", { name: "Continuă" }).click();
  await page.getByRole("button", { name: "Confirmă configurația" }).click();

  // Scris cu tastatura, cu virgulă, exact cum face un șofer.
  await page.getByLabel("Plăți pentru curse în aplicație").pressSequentially("1.225,78");
  await page.getByLabel("Comision Bolt").pressSequentially("200,5");
  await expect(page.getByLabel("Plăți pentru curse în aplicație")).toHaveValue("1.225,78");
  await expect(page.locator(".earnings-total")).toHaveText(/1\.025,28 RON/);
  await page.getByLabel("Kilometri parcurși").pressSequentially("100");
  await page.getByLabel(/Prețul din ziua respectivă/).pressSequentially("7,49");
  // 100 km × 8,5 l/100 km × 7,49 lei = 63,67 lei.
  await expect(page.locator(".calculation-preview")).toContainText("63,67 RON");
});
