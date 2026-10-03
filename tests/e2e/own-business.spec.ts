import { expect, test } from "@playwright/test";

test("cu propriul PFA nu apare flota, iar costurile firmei intră în calcul", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Creează cont gratuit" }).first().click();
  await page.getByLabel("Adresă de email").fill("pfa@profitexact.test");
  await page.getByLabel("Parolă", { exact: true }).fill("profitexact123");
  await page.getByLabel("Confirmă parola").fill("profitexact123");
  await page.getByRole("button", { name: "Creează contul" }).click();
  await page.getByLabel("Cod primit pe email").fill("123456");
  await page.getByRole("button", { name: "Verifică emailul" }).click();

  await page.getByRole("button", { name: "Continuă" }).click();
  await page.getByRole("button", { name: /Propriul SRL\/PFA/ }).click();
  // Fără forma firmei nu se poate continua.
  await expect(page.getByRole("button", { name: "Continuă" })).toBeDisabled();
  await page.getByRole("button", { name: "SRL", exact: true }).click();
  await expect(page.getByText("Cum este impozitat SRL-ul?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuă" })).toBeDisabled();
  await page.getByRole("button", { name: "Microîntreprindere" }).click();
  await expect(page.getByRole("button", { name: "Continuă" })).toBeEnabled();
  // La schimbarea formei, alegerea de impozitare se reia.
  await page.getByRole("button", { name: "PFA", exact: true }).click();
  await expect(page.getByText("Cum este impozitat PFA-ul?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Microîntreprindere" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continuă" })).toBeDisabled();
  await page.getByRole("button", { name: "Normă de venit" }).click();
  await expect(page.getByText(/verifică cu contabilul/)).toBeVisible();
  await page.getByRole("button", { name: "Continuă" }).click();

  await page.getByRole("button", { name: "Continuă" }).click();
  await page.getByLabel("Orașul principal în care lucrezi").fill("Brasov");
  await page.getByRole("button", { name: "Continuă" }).click();
  await page.getByRole("button", { name: "Continuă" }).click();

  await expect(page.getByRole("heading", { name: "Ce costuri are PFA-ul tău?" })).toBeVisible();
  await expect(page.getByText("Valoare comision")).toHaveCount(0);
  await expect(page.getByText("Salariu: tu sau șoferul angajat")).toHaveCount(0);
  await page.getByLabel("Plătești contabilitate?").check();
  await page.getByLabel("Cost contabilitate").fill("300");
  // Costurile ARR, în ordinea obținerii, cu tarifele obișnuite doar ca exemplu.
  await page.getByLabel("1. Licență de transport alternativ").check();
  const license = page.locator(".conditional-cost", { hasText: "1. Licență" }).getByRole("textbox");
  await expect(license).toHaveValue("");
  await expect(license).toHaveAttribute("placeholder", "ex. 300");
  await license.fill("300");
  await page.getByLabel("2. Copie conformă").check();
  await page.getByLabel("Valabilitate").selectOption("3");
  const copy = page.getByLabel("Suma plătită pentru 3 ani, toate mașinile");
  await expect(copy).toHaveAttribute("placeholder", "ex. 300");
  await copy.fill("300");
  await page.getByLabel("3. Ecusoane").check();
  await expect(page.getByLabel("Suma plătită, toate mașinile")).toHaveAttribute("placeholder", "ex. 16");
  await expect(page.getByText("De obicei 8 lei/ecuson", { exact: false })).toBeVisible();
  await page.getByLabel("Suma plătită, toate mașinile").fill("16");
  await expect(page.getByText("Țin cât copia conformă (3 ani).")).toBeVisible();
  // La PFA nu există certificat de manager și nici salariu.
  await expect(page.getByText("Certificat de manager de transport")).toHaveCount(0);
  await expect(page.getByText("La PFA nu ești obligat să ai contabil", { exact: false })).toBeVisible();
  await expect(page.getByText("Costuri casă de marcat")).toBeVisible();
  await page.getByRole("button", { name: "Continuă" }).click();

  await page.getByLabel("Consum aproximativ").fill("6");
  await page.getByRole("button", { name: "Continuă" }).click();

  await expect(page.getByText("Ridesharing · Propriul PFA")).toBeVisible();
  await expect(page.getByText("Normă de venit", { exact: true })).toBeVisible();
  await expect(page.getByText("Comision flotă")).toHaveCount(0);
  await expect(page.getByText("Contabilitate: 300 RON / lună")).toBeVisible();
  await expect(page.getByText("Licență de transport alternativ (împărțită pe 12 luni): 300 RON o singură dată")).toBeVisible();
  await expect(page.getByText("Copie conformă (3 ani): 300 RON pentru 1095 zile")).toBeVisible();
  await page.getByRole("button", { name: "Confirmă configurația" }).click();

  await page.getByLabel("Plăți pentru curse în aplicație").fill("545");
  await page.getByLabel("Plăți pentru curse în numerar").fill("400");
  await page.getByLabel("Comision Bolt").fill("200");
  await expect(page.locator(".earnings-cash-pill.card")).toHaveText(/Bani pe card, în contul firmei.*345,00 RON/);

  await expect(page.locator(".result-label")).toHaveText("Îți rămân azi, înainte de taxe");
  const details = page.locator(".breakdown-card").first();
  await expect(details.getByText("Contabilitate · alocat/zi")).toBeVisible();
  await expect(details.getByText("Licență de transport alternativ (împărțită pe 12 luni) · alocat/zi")).toBeVisible();
  await expect(details.getByText("Ecusoane · alocat/zi")).toBeVisible();
  await expect(details.getByText("Comision flotă")).toHaveCount(0);
  await expect(details.getByText(/CIM/)).toHaveCount(0);
  await expect(page.getByText("Regularizarea zilei")).toHaveCount(0);
  await expect(page.locator(".weekly-card .eyebrow")).toHaveText("Rezultatul săptămânii");

  await page.getByRole("button", { name: "Salvează ziua în săptămână" }).click();
  await expect(page.locator(".weekly-card h2")).toHaveText(/Îți rămân .* RON, înainte de taxe/);
});
