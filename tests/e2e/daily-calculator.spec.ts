import { expect, test } from "@playwright/test";

test("toate butoanele de creare cont deschid formularul", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Creează cont", exact: true }).click();
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
  await page.getByRole("button", { name: "Creează cont", exact: true }).click();
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
  await page.getByLabel("Număr de telefon").fill("0712 345 678");
  await page.getByLabel("Parolă", { exact: true }).fill("profitexact123");
  await page.getByLabel("Confirmă parola").fill("profitexact123");
  await page.getByRole("button", { name: "Creează contul" }).click();
  await expect(page.getByRole("heading", { name: "Verifică emailul" })).toBeVisible();
  await page.getByLabel("Cod primit pe email").fill("123456");
  await page.getByRole("button", { name: "Verifică emailul" }).click();
  await expect(page.getByRole("heading", { name: "Verifică telefonul" })).toBeVisible();
  await page.getByLabel("Cod primit prin SMS").fill("123456");
  await page.getByRole("button", { name: "Verifică telefonul și continuă" }).click();

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
    "Încasări card din curse",
    "Încasări cash din curse",
    "Comisionul oprit de aplicație",
    "Compensări",
    "Tips prin aplicație/card",
    "Tips cash",
    "Curse private",
    "Câți kilometri ai parcurs pentru activitate azi?",
    "Câte ore ai lucrat azi?",
    "Prețul din ziua respectivă / litru",
  ]) {
    await expect(page.getByLabel(label)).toHaveValue("");
  }

  await expect(page.getByRole("button", { name: "Salvează ziua în săptămână" })).toBeDisabled();

  await page.getByLabel("Încasări card din curse").fill("500");
  await page.getByLabel("Încasări cash din curse").fill("400");
  await page.getByLabel("Comisionul oprit de aplicație").fill("200");
  await page.getByLabel("Compensări").fill("20");
  await page.getByLabel("Tips prin aplicație/card").fill("25");
  await page.getByLabel("Tips cash").fill("15");
  await page
    .getByLabel("Câți kilometri ai parcurs pentru activitate azi?")
    .fill("180");
  await page.getByLabel("Câte ore ai lucrat azi?").fill("8");
  await page.getByLabel("Prețul din ziua respectivă / litru").fill("7.2");
  await expect(page.getByText("Îți rămân azi")).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvează ziua în săptămână" })).toBeEnabled();

  await expect(
    page.getByLabel("Câți kilometri ai parcurs pentru activitate azi?"),
  ).toHaveValue("180");
  await expect(page.getByLabel("Câte ore ai lucrat azi?")).toHaveValue("8");
  await expect(
    page.locator(".calculation-preview").getByText("110,16 RON", { exact: true }),
  ).toBeVisible();

  await page.getByLabel("Ai spălat mașina azi?").check();
  await page.getByLabel("Suma plătită la spălătorie").fill("20");

  await expect(page.getByText("431,27 RON", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Salvează ziua în săptămână" }).click();
  await expect(page.getByText("Regularizarea săptămânii")).toBeVisible();
  await expect(page.getByText("1", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Săptămânal" }).click();
  await expect(page.getByRole("heading", { name: "Centralizarea săptămânii" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Centralizare automată" })).toBeVisible();
  await expect(page.getByText("Datele nu sunt dublate.")).toBeVisible();

  await page.getByLabel("Alege o zi din săptămână").fill("2026-10-14");
  await expect(page.getByRole("heading", { name: "Nu există date în această perioadă" })).toBeVisible();
  await expect(page.getByLabel("Comisionul oprit de aplicație")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Salvează săptămâna" })).toBeDisabled();

  await page.getByLabel("Încasări card din curse").fill("803.90");
  await page.getByLabel("Încasări cash din curse").fill("566.30");
  await page.getByLabel("Comisionul oprit de aplicație").fill("395.72");
  await page.getByLabel("Compensări / campanii / taxe de anulare").fill("231.30");
  await page.getByLabel("Tips prin aplicație/card").fill("20");
  await page.getByLabel("Zile lucrate").fill("4");
  await page.getByLabel("Ore lucrate").fill("25");
  await page.getByLabel("Kilometri parcurși").fill("500");
  await page.getByRole("button", { name: "Salvează săptămâna" }).click();
  await expect(page.getByText("Perioadă introdusă manual")).toBeVisible();

  await page.getByRole("button", { name: "Lunar" }).click();
  await expect(page.getByRole("heading", { name: "Centralizarea lunii" })).toBeVisible();
  await expect(page.getByText(/1 săptămâni introduse manual/)).toBeVisible();
  await expect(page.getByText("Săptămână · 12.10.2026–18.10.2026")).toBeVisible();
});
