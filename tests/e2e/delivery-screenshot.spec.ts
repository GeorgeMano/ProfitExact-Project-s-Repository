import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * Citirea capturilor din aplicațiile de livrări, cap-coadă, cu imagini reale
 * (Wolt „Statisticile tale”, Bolt Food „Toate livrările”). Imaginile conțin
 * date reale, deci stau în `tests/fixtures/private` și nu se publică.
 */
const fixture = (name: string) => path.resolve("tests/fixtures/private", name);
const woltMonth = fixture("wolt-luna.jpg");
const woltWeek = fixture("wolt-saptamana.jpg");
const boltFoodList = fixture("boltfood-toate-livrarile.jpg");

async function serveOcrAssetsLocally(context: BrowserContext) {
  const modules = path.resolve("node_modules");
  await context.route(/cdn\.jsdelivr\.net\/npm\/tesseract\.js@[^/]+\/dist\/(.+)$/, (route, request) => {
    const file = request.url().split("/dist/")[1];
    return route.fulfill({ path: path.join(modules, "tesseract.js/dist", file), contentType: "application/javascript" });
  });
  await context.route(/cdn\.jsdelivr\.net\/npm\/tesseract\.js-core@[^/]+\/(.+)$/, (route, request) => {
    const file = request.url().split("/").pop()!;
    return route.fulfill({
      path: path.join(modules, "tesseract.js-core", file),
      contentType: file.endsWith(".wasm") ? "application/wasm" : "application/javascript",
    });
  });
  await context.route(/cdn\.jsdelivr\.net\/npm\/@tesseract\.js-data\/ron\/4\.0\.0_best_int\/ron\.traineddata\.gz$/, (route) =>
    route.fulfill({
      body: readFileSync(path.join(modules, "@tesseract.js-data/ron/4.0.0_best_int/ron.traineddata.gz")),
      contentType: "application/octet-stream",
    }),
  );
}

async function onboardCourier(page: Page, email: string, app: RegExp) {
  await page.goto("/");
  await page.getByRole("button", { name: "Creează cont gratuit" }).first().click();
  await page.getByLabel("Adresă de email").fill(email);
  await page.getByLabel("Parolă", { exact: true }).fill("profitexact123");
  await page.getByLabel("Confirmă parola").fill("profitexact123");
  await page.getByRole("button", { name: "Creează contul" }).click();
  await page.getByLabel("Cod primit pe email").fill("123456");
  await page.getByRole("button", { name: "Verifică emailul" }).click();
  const next = () => page.getByRole("button", { name: "Continuă" }).click();
  await page.getByRole("button", { name: /^Delivery/ }).click();
  await next();
  await next();
  await page.getByRole("button", { name: app }).click();
  await next();
  await page.getByLabel("Orașul principal în care lucrezi").fill("Pitesti");
  await next();
  await page.getByRole("button", { name: /^Bicicletă Fără combustibil/ }).click();
  await next();
  await page.getByLabel("Valoare comision").fill("10");
  await next();
  await next();
  await page.getByRole("button", { name: "Confirmă configurația" }).click();
}

const woltCustom = fixture("wolt-personalizat.jpg");
const woltDay = fixture("wolt-azi.jpg");
const glovoWeek = fixture("glovo-payments-saptamana.jpg");

/** Ca la ridesharing: „Încarcă captura” → „Ce dorești să calculezi?” → fișierul. */
async function uploadCapture(page: Page, period: "O zi" | "O săptămână întreagă" | "O lună întreagă", file: string) {
  await page.getByRole("button", { name: "Încarcă captura" }).first().click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: period }).click();
  await (await chooser).setFiles(file);
}

test.skip(![woltMonth, woltWeek, woltCustom, woltDay, boltFoodList, glovoWeek].every(existsSync), "Imaginile de test private lipsesc.");

test("Wolt: captura lunii, încărcată din formularul zilei, ajunge în luna din captură", async ({ page, context }) => {
  test.setTimeout(150_000);
  await serveOcrAssetsLocally(context);
  await onboardCourier(page, "wolt@profitexact.test", /^Wolt/);

  // Rubricile, în ordinea ecranului Wolt.
  const labels = await page.locator(".earnings-sheet .earnings-label").allTextContents();
  expect(labels.slice(0, 4).map((label) => label.split("În timpul")[0])).toEqual([
    "Livrări finalizate",
    "Distanța parcursă",
    "Câștiguri fără bacșiș",
    "Bacșiș",
  ]);

  await uploadCapture(page, "O lună întreagă", woltMonth);
  await expect(page.locator(".screenshot-import-status.ok")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByLabel("Alege luna")).toHaveValue("2026-09");
  await expect(page.getByLabel("Livrări finalizate")).toHaveValue("2");
  await expect(page.getByLabel("Kilometri parcurși")).toHaveValue("11,9");
  await expect(page.getByLabel("Câștiguri fără bacșiș")).toHaveValue("21,1");
  await expect(page.locator(".earnings-total")).toHaveText(/21,10 RON/);
  await expect(page.locator(".screenshot-import-status.ok")).toContainText("estimare");
});

test("Wolt: perioada din captură are întâietate, iar „Personalizat” merge la perioada aleasă", async ({ page, context }) => {
  test.setTimeout(150_000);
  await serveOcrAssetsLocally(context);
  await onboardCourier(page, "wolt2@profitexact.test", /^Wolt/);

  // Ales „O zi”, dar captura e de săptămână: merge în săptămâna din captură.
  await uploadCapture(page, "O zi", woltWeek);
  await expect(page.locator(".screenshot-import-status.ok")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByLabel("Alege o zi din săptămână")).toHaveValue("2026-08-31");
  await expect(page.getByLabel("Câștiguri fără bacșiș")).toHaveValue("44,1");
  await expect(page.locator(".screenshot-import-status.ok")).toContainText("Ai ales o zi, dar captura este pentru o săptămână");

  // „Personalizat” (03.08 – 03.09): la luna aleasă, cu bacșișul separat.
  await uploadCapture(page, "O lună întreagă", woltCustom);
  await expect(page.locator(".screenshot-import-status.ok")).toContainText("perioadă personalizată", { timeout: 60_000 });
  await expect(page.getByLabel("Alege luna")).toHaveValue("2026-08");
  await expect(page.getByLabel("Câștiguri fără bacșiș")).toHaveValue("119");
  await expect(page.getByLabel("Bacșiș în aplicație")).toHaveValue("6");
  await expect(page.getByLabel("Livrări finalizate")).toHaveValue("10");
  await expect(page.locator(".earnings-total")).toHaveText(/125,00 RON/);

  // „Azi” (3 septembrie), din formularul lunii: se deschide ziua din captură.
  await uploadCapture(page, "O zi", woltDay);
  await expect(page.locator(".screenshot-import-status.ok")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByLabel("Data activității")).toHaveValue("2026-09-03");
  await expect(page.getByLabel("Livrări finalizate")).toHaveValue("");
  await expect(page.locator(".earnings-total")).toHaveText(/0,00 RON/);
});

test("Bolt Food: ziua și săptămâna din „Toate livrările”", async ({ page, context }) => {
  test.setTimeout(150_000);
  await serveOcrAssetsLocally(context);
  await onboardCourier(page, "boltfood@profitexact.test", /^Bolt Food/);

  await page.getByLabel("Data activității").fill("2026-07-14");
  await uploadCapture(page, "O zi", boltFoodList);
  await expect(page.locator(".screenshot-import-status.ok")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByLabel("Data activității")).toHaveValue("2026-07-14");
  await expect(page.getByLabel("Câștig din livrări")).toHaveValue("30,99");
  await expect(page.getByLabel("Livrări finalizate")).toHaveValue("2");

  // Din formularul zilei, „O săptămână întreagă” duce în săptămâna din captură.
  await uploadCapture(page, "O săptămână întreagă", boltFoodList);
  await expect(page.locator(".screenshot-import-status.ok")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByLabel("Alege o zi din săptămână")).toHaveValue("2026-07-15");
  // 14 iulie (30,99) + 15 iulie (24,00).
  await expect(page.getByLabel("Câștig din livrări")).toHaveValue("54,99");
  await expect(page.getByLabel("Livrări finalizate")).toHaveValue("4");
  await expect(page.locator(".screenshot-import-status.ok")).toContainText("Am adunat 2 zile");
});

test("Glovo: săptămâna din „Payments”, cu anul de sub perioadă", async ({ page, context }) => {
  test.setTimeout(150_000);
  await serveOcrAssetsLocally(context);
  await onboardCourier(page, "glovo@profitexact.test", /^Glovo/);

  await uploadCapture(page, "O săptămână întreagă", glovoWeek);
  await expect(page.locator(".screenshot-import-status.ok")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByLabel("Alege o zi din săptămână")).toHaveValue("2026-09-28");
  await expect(page.getByLabel("Venit total")).toHaveValue("");
  await expect(page.locator(".needs-check")).toHaveCount(0);

  // Textul exact citit din imagine, cu tot cu zgomotul OCR-ului.
  await page.getByText("Vezi textul citit din captură").click();
  await expect(page.locator(".ocr-raw pre")).toContainText("Total income");
  await expect(page.locator(".ocr-raw pre")).toContainText("Cancelled");
});
