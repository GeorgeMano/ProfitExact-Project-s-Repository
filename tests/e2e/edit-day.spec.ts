import { expect, test, type Page } from "@playwright/test";

/**
 * Verifică faptul că o zi salvată poate fi corectată: formularul se completează
 * cu ce a fost introdus atunci, inclusiv prețul combustibilului și cheltuielile
 * punctuale, iar salvarea o actualizează în loc să adauge una nouă.
 */

async function createDemoAccount(page: Page) {
  await page.getByRole("button", { name: "Creează cont gratuit" }).first().click();
  await page.getByLabel("Adresă de email").fill("sofer@profitexact.test");
  await page.getByLabel("Număr de telefon").fill("0712 345 678");
  await page.getByLabel("Parolă", { exact: true }).fill("profitexact123");
  await page.getByLabel("Confirmă parola").fill("profitexact123");
  await page.getByRole("button", { name: "Creează contul" }).click();
  await page.getByLabel("Cod primit pe email").fill("123456");
  await page.getByRole("button", { name: "Verifică emailul" }).click();
  await page.getByLabel("Cod primit prin SMS").fill("123456");
  await page.getByRole("button", { name: "Verifică telefonul și continuă" }).click();
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

async function fillAndSaveDay(page: Page) {
  await page.getByLabel("Plăți pentru curse în aplicație").fill("500");
  await page.getByLabel("Plăți pentru curse în numerar").fill("400");
  await page.getByLabel("Comision Bolt").fill("200");
  await page.getByLabel("Kilometri parcurși").fill("180");
  await page.getByLabel("Câte ore ai lucrat azi?").fill("8");
  await page.getByLabel("Prețul din ziua respectivă / litru").fill("7.2");
  await page.getByLabel("Ai spălat mașina azi?").check();
  await page.getByLabel("Suma plătită la spălătorie").fill("20");
  await page.getByRole("button", { name: "Salvează ziua în săptămână" }).click();
  await expect(page.locator(".weekly-metrics")).toBeVisible();
}

/**
 * O altă zi din aceeași săptămână luni–duminică, ca rezumatul săptămânii să
 * rămână același. Calculată, nu scrisă fix, ca testul să nu depindă de data la
 * care este rulat.
 */
function otherDayInSameWeek(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + (weekday === 7 ? -1 : 1));
  return date.toISOString().slice(0, 10);
}

test("ziua salvată se deschide înapoi cu toate valorile introduse", async ({ page }) => {
  await page.goto("/");
  await createDemoAccount(page);
  await completeOnboarding(page);
  await fillAndSaveDay(page);

  // Aplicația recunoaște că ziua aleasă este deja salvată.
  await expect(page.getByText("Corectezi ziua de")).toBeVisible();
  await expect(page.getByRole("button", { name: "Actualizează ziua" })).toBeVisible();

  const salvata = await page.getByLabel("Data activității").inputValue();

  // Plecăm pe altă zi din aceeași săptămână: formularul trebuie să se golească.
  await page.getByLabel("Data activității").fill(otherDayInSameWeek(salvata));
  await expect(page.getByLabel("Plăți pentru curse în aplicație")).toHaveValue("");
  await expect(page.getByLabel("Prețul din ziua respectivă / litru")).toHaveValue("");
  await expect(page.getByLabel("Ai spălat mașina azi?")).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Salvează ziua în săptămână" }),
  ).toBeVisible();

  // Ne întoarcem prin butonul zilei din rezumatul săptămânii.
  await page.locator(".saved-days button").first().click();

  await expect(page.getByLabel("Plăți pentru curse în aplicație")).toHaveValue("500");
  await expect(page.getByLabel("Plăți pentru curse în numerar")).toHaveValue("400");
  await expect(page.getByLabel("Comision Bolt")).toHaveValue("200");
  await expect(page.getByLabel("Kilometri parcurși")).toHaveValue("180");
  await expect(page.getByLabel("Câte ore ai lucrat azi?")).toHaveValue("8");
  // Prețul unitar și cheltuiala punctuală sunt exact ce se pierdea înainte.
  await expect(page.getByLabel("Prețul din ziua respectivă / litru")).toHaveValue("7.2");
  await expect(page.getByLabel("Ai spălat mașina azi?")).toBeChecked();
  await expect(page.getByLabel("Suma plătită la spălătorie")).toHaveValue("20");
});

test("corectarea actualizează ziua, nu adaugă una nouă", async ({ page }) => {
  await page.goto("/");
  await createDemoAccount(page);
  await completeOnboarding(page);
  await fillAndSaveDay(page);

  const zileInainte = await page.locator(".saved-days button").count();
  const oreInainte = await page.locator(".weekly-metrics").innerText();
  expect(zileInainte).toBe(1);
  expect(oreInainte).toContain("8");

  // Corectăm orele și comisionul, apoi salvăm din nou.
  await page.getByLabel("Câte ore ai lucrat azi?").fill("10");
  await page.getByLabel("Comision Bolt").fill("250");
  await page.getByRole("button", { name: "Actualizează ziua" }).click();

  await expect(page.locator(".saved-days button")).toHaveCount(1);
  await expect(page.locator(".weekly-metrics")).toContainText("10");
});

test("corecția supraviețuiește reîncărcării paginii", async ({ page }) => {
  await page.goto("/");
  await createDemoAccount(page);
  await completeOnboarding(page);
  await fillAndSaveDay(page);

  await page.getByLabel("Suma plătită la spălătorie").fill("35");
  await page.getByRole("button", { name: "Actualizează ziua" }).click();

  await page.reload();
  await page.getByRole("button", { name: "Continuă de unde ai rămas" }).click();

  await expect(
    page.getByRole("heading", { name: "Adaugă o zi de lucru" }),
  ).toBeVisible();
  await expect(page.getByLabel("Suma plătită la spălătorie")).toHaveValue("35");
  await expect(page.getByRole("button", { name: "Actualizează ziua" })).toBeVisible();
});
