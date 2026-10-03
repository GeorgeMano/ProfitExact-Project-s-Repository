import { expect, test, type Page } from "@playwright/test";
import { clickTopAction } from "./menu";

/**
 * Conectarea, parola uitată și ieșirea din cont, în modul de depanare local.
 * Aici contul de test stă pe calculator, deci parola nu se verifică; cu
 * Supabase configurat, aceleași ecrane trec prin Supabase Auth.
 */

async function createAccountAndOnboard(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Creează cont gratuit" }).first().click();
  await page.getByLabel("Adresă de email").fill("sofer@profitexact.test");
  await page.getByLabel("Parolă", { exact: true }).fill("profitexact123");
  await page.getByLabel("Confirmă parola").fill("profitexact123");
  await page.getByRole("button", { name: "Creează contul" }).click();
  await page.getByLabel("Cod primit pe email").fill("123456");
  await page.getByRole("button", { name: "Verifică emailul" }).click();

  await expect(page.getByRole("heading", { name: "Ce tip de activitate faci?" })).toBeVisible();
  for (let step = 0; step < 3; step += 1) {
    await page.getByRole("button", { name: "Continuă" }).click();
  }
  await page.getByLabel("Orașul principal în care lucrezi").fill("Pitești");
  await page.getByRole("button", { name: "Continuă" }).click();
  await page.getByRole("button", { name: "Continuă" }).click();
  await page.getByLabel("Valoare comision").fill("10");
  await page.getByRole("button", { name: "Continuă" }).click();
  await page.getByLabel("Consum aproximativ").fill("8.5");
  await page.getByRole("button", { name: "Continuă" }).click();
  await page.getByRole("button", { name: "Confirmă configurația" }).click();
  await expect(page.getByRole("heading", { name: "Adaugă o zi de lucru" })).toBeVisible();
}

test("ieșirea din cont păstrează datele, iar conectarea le aduce înapoi", async ({ page }) => {
  await createAccountAndOnboard(page);

  await clickTopAction(page, "Ieși din cont");
  await expect(page.getByRole("heading", { name: /Știi cât încasezi/ })).toBeVisible();
  // După ieșire nu se mai intră fără conectare.
  await expect(page.getByRole("button", { name: "Continuă de unde ai rămas" })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("button", { name: "Continuă de unde ai rămas" })).toHaveCount(0);

  await page.getByRole("button", { name: "Intră în cont" }).first().click();
  await expect(page.getByRole("heading", { name: "Intră în cont" })).toBeVisible();
  await page.getByLabel("Adresă de email").fill("sofer@profitexact.test");
  await page.getByLabel("Parolă").fill("orice");
  await page.getByRole("button", { name: "Intră în cont" }).click();

  await expect(page.getByRole("heading", { name: "Adaugă o zi de lucru" })).toBeVisible();
  await expect(page.locator(".config-strip").getByText("Pitesti", { exact: true })).toBeVisible();
});

test("conectarea cu un email necunoscut explică de ce nu merge", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Intră în cont" }).first().click();
  await page.getByLabel("Adresă de email").fill("altcineva@profitexact.test");
  await page.getByLabel("Parolă").fill("profitexact123");
  await page.getByRole("button", { name: "Intră în cont" }).click();
  await expect(page.locator(".account-error")).toHaveText(
    "Nu există niciun cont cu acest email pe acest calculator.",
  );
});

test("parola uitată se schimbă cu un cod primit pe email", async ({ page }) => {
  await createAccountAndOnboard(page);
  await clickTopAction(page, "Ieși din cont");

  await page.getByRole("button", { name: "Intră în cont" }).first().click();
  await page.getByRole("button", { name: "Am uitat parola" }).click();
  await expect(page.getByRole("heading", { name: "Ai uitat parola?" })).toBeVisible();
  await page.getByLabel("Adresă de email").fill("sofer@profitexact.test");
  await page.getByRole("button", { name: "Trimite codul" }).click();

  await expect(page.getByRole("heading", { name: "Alege parola nouă" })).toBeVisible();
  await page.getByLabel("Cod primit pe email").fill("123456");
  await page.getByLabel("Parolă nouă", { exact: true }).fill("scurta");
  await page.getByLabel("Confirmă parola nouă").fill("scurta");
  await page.getByRole("button", { name: "Salvează parola și intră" }).click();
  await expect(page.locator(".account-error")).toHaveText(
    "Parola trebuie să aibă cel puțin 8 caractere.",
  );

  await page.getByLabel("Parolă nouă", { exact: true }).fill("parolanoua2026");
  await page.getByLabel("Confirmă parola nouă").fill("parolanoua2026");
  await page.getByRole("button", { name: "Salvează parola și intră" }).click();
  await expect(page.getByRole("heading", { name: "Adaugă o zi de lucru" })).toBeVisible();
});

test("din formularul de cont se ajunge la conectare și înapoi", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Creează cont gratuit" }).first().click();
  await page.locator(".account-note").getByRole("button", { name: "Intră în cont" }).click();
  await expect(page.getByRole("heading", { name: "Intră în cont" })).toBeVisible();
  await page.getByRole("button", { name: "Creează cont gratuit" }).click();
  await expect(page.getByRole("heading", { name: "Creează contul" })).toBeVisible();
});
