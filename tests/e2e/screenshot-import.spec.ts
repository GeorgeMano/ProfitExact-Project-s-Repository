import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * Completarea rubricilor din captura „Defalcarea câștigurilor”, cap-coadă:
 * imaginea reală, citirea în browser, rubricile completate și verificate.
 *
 * Imaginea de test conține câștiguri reale, deci stă în `tests/fixtures/private`
 * și nu se publică pe GitHub. Fără ea, testul se sare.
 *
 * Cititorul își descarcă la prima folosire fișierele de pe CDN; în test sunt
 * servite din `node_modules`, ca testul să meargă și fără internet.
 */
const photo = path.resolve("tests/fixtures/private/bolt-saptamana-foto.jpeg");

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

async function createAccountAndOnboard(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Creează cont gratuit" }).first().click();
  await page.getByLabel("Adresă de email").fill("sofer@profitexact.test");
  await page.getByLabel("Parolă", { exact: true }).fill("profitexact123");
  await page.getByLabel("Confirmă parola").fill("profitexact123");
  await page.getByRole("button", { name: "Creează contul" }).click();
  await page.getByLabel("Cod primit pe email").fill("123456");
  await page.getByRole("button", { name: "Verifică emailul" }).click();
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
}

test.skip(!existsSync(photo), "Imaginea de test privată lipsește.");

test("completează săptămâna din fotografia ecranului Bolt", async ({ page, context }) => {
  test.setTimeout(120_000);
  await serveOcrAssetsLocally(context);
  await createAccountAndOnboard(page);

  await page.getByRole("button", { name: "Săptămânal" }).click();
  await page.getByLabel("Alege o zi din săptămână").fill("2026-09-03");
  await expect(page.getByRole("heading", { name: /^Introdu totalul/ })).toBeVisible();

  await page.getByLabel("Captură Bolt").setInputFiles(photo);
  await expect(page.locator(".screenshot-import-status.ok")).toBeVisible({ timeout: 90_000 });

  await expect(page.getByLabel("Plăți pentru curse în aplicație")).toHaveValue("803.9");
  await expect(page.getByLabel("Campanii")).toHaveValue("9");
  await expect(page.getByLabel("Taxe de anulare")).toHaveValue("24");
  await expect(page.getByLabel("Bacșiș în aplicație")).toHaveValue("20");
  await expect(page.getByLabel("Plăți pentru curse în numerar")).toHaveValue("566.3");
  await expect(page.getByLabel("Credite și promoții pentru utilizatori")).toHaveValue("198.3");
  await expect(page.getByLabel("Comision Bolt")).toHaveValue("395.72");

  // Aceleași totaluri ca în aplicația Bolt, fără nicio rubrică de verificat.
  await expect(page.locator(".earnings-total")).toHaveText(/1\.225,78 RON/);
  await expect(page.locator(".earnings-cash-pill.card")).toHaveText(/659,48 RON/);
  await expect(page.locator(".needs-check")).toHaveCount(0);

  // Utilizatorul confirmă și salvează.
  await page.getByRole("button", { name: "Salvează săptămâna" }).click();
  await expect(page.getByRole("heading", { name: /introdus de tine/ })).toBeVisible();
});

test("din formularul zilei, captura săptămânală duce în săptămâna din captură", async ({ page, context }) => {
  test.setTimeout(120_000);
  await serveOcrAssetsLocally(context);
  await createAccountAndOnboard(page);

  // Formularul zilei e deschis pe azi; captura e din 31 aug. – 6 sept.
  await page.getByRole("button", { name: "Încarcă captura" }).click();
  await expect(page.getByText("Ce dorești să calculezi? Pentru ce perioadă este captura?")).toBeVisible();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "O săptămână întreagă" }).click();
  await (await chooser).setFiles(photo);

  await expect(page.getByRole("heading", { name: "Centralizarea săptămânii" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByLabel("Alege o zi din săptămână")).toHaveValue("2026-08-31");
  await expect(page.getByLabel("Comision Bolt")).toHaveValue("395.72");
  await expect(page.locator(".earnings-total")).toHaveText(/1\.225,78 RON/);
  await expect(page.getByText("Perioada din captură: 31.08.2026 – 06.09.2026.")).toBeVisible();

  await page.getByLabel("Kilometri parcurși").fill("500");
  await page.getByRole("button", { name: "Salvează săptămâna" }).click();
  await expect(page.getByRole("heading", { name: /introdus de tine/ })).toBeVisible();

  // Înapoi la zi: regularizarea săptămânii folosește totalul introdus.
  await page.getByRole("button", { name: "Zilnic" }).click();
  await page.getByLabel("Data activității").fill("2026-09-02");
  await expect(page.locator(".weekly-card")).toContainText("Calculat din totalul săptămânii");
  await expect(page.locator(".weekly-card")).toContainText("Km (estimativ)");
});

test("o captură de săptămână încărcată ca „O zi” e recunoscută", async ({ page, context }) => {
  test.setTimeout(120_000);
  await serveOcrAssetsLocally(context);
  await createAccountAndOnboard(page);

  await page.getByRole("button", { name: "Încarcă captura" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "O zi" }).click();
  await (await chooser).setFiles(photo);

  await expect(page.getByText("Captura pare să fie pentru 31.08.2026 – 06.09.2026, nu pentru o singură zi.")).toBeVisible({ timeout: 90_000 });
  // Rubricile zilei nu se completează cu cifrele unei săptămâni.
  await expect(page.getByLabel("Comision Bolt")).toHaveValue("");

  await page.getByRole("button", { name: "Folosește captura pentru toată săptămâna" }).click();
  await expect(page.getByRole("heading", { name: "Centralizarea săptămânii" })).toBeVisible();
  await expect(page.getByLabel("Comision Bolt")).toHaveValue("395.72");
});
