import { expect, test, type Page } from "@playwright/test";
import { clickTopAction } from "./menu";

// Un cont nou pe același calculator pornește de la zero: nu moștenește zilele,
// configurarea sau emailul contului de dinainte.

async function createAccount(page: Page, email: string) {
  await page.getByRole("button", { name: "Creează cont gratuit" }).first().click();
  await page.getByLabel("Adresă de email").fill(email);
  await page.getByLabel("Parolă", { exact: true }).fill("profitexact123");
  await page.getByLabel("Confirmă parola").fill("profitexact123");
  await page.getByRole("button", { name: "Creează contul" }).click();
  await page.getByLabel("Cod primit pe email").fill("123456");
  await page.getByRole("button", { name: "Verifică emailul" }).click();
}

const next = (page: Page) => page.getByRole("button", { name: "Continuă" }).click();

async function onboard(page: Page) {
  await next(page);
  await next(page);
  await next(page);
  await page.getByLabel("Orașul principal în care lucrezi").fill("Pitesti");
  await next(page);
  await next(page);
  await page.getByLabel("Valoare comision").fill("10");
  await next(page);
  await page.getByLabel("Consum aproximativ").fill("8");
  await next(page);
  await page.getByRole("button", { name: "Confirmă configurația" }).click();
}

test("un cont nou nu vede zilele contului vechi de pe același calculator", async ({ page }) => {
  await page.goto("/");
  await createAccount(page, "vechi@profitexact.test");
  await onboard(page);
  await page.getByLabel("Plăți pentru curse în aplicație").fill("900");
  await page.getByLabel("Comision Bolt").fill("100");
  await page.getByLabel("Câte ore ai lucrat azi?").fill("8");
  await page.getByRole("button", { name: "Salvează ziua în săptămână" }).click();
  await expect(page.locator(".weekly-card")).toContainText("8 ore");

  await clickTopAction(page, "Ieși din cont");
  await createAccount(page, "nou@profitexact.test");
  // Configurarea pornește de la capăt, nu sare direct în calculator.
  await expect(page.getByText("Pasul 1 din", { exact: false })).toBeVisible();
  await onboard(page);

  await expect(page.locator(".weekly-card")).not.toContainText("8 ore");
  await expect(page.locator(".weekly-card")).not.toContainText("Flota îți datorează");
  await expect(page.getByText("Calculul nu este gata")).toBeVisible();

  // Vechiul cont nu mai există pe calculator: conectarea cu el nu merge.
  await clickTopAction(page, "Ieși din cont");
  await page.getByRole("button", { name: "Intră în cont" }).first().click();
  await page.getByLabel("Adresă de email").fill("vechi@profitexact.test");
  await page.getByLabel("Parolă", { exact: true }).fill("profitexact123");
  await page.getByRole("button", { name: "Intră în cont" }).last().click();
  await expect(page.getByText("Nu există niciun cont cu acest email pe acest calculator.")).toBeVisible();
});
