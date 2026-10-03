import { expect, test, type Page } from "@playwright/test";
import { clickTopAction } from "./menu";

/**
 * Verifică defalcarea pe platformă: că alegerea „Separat pe platformă” chiar
 * schimbă ceva, că fiecare aplicație are propriile încasări, propriul comision
 * și propriii kilometri, și — cel mai important — că profitul zilei este
 * identic indiferent cum alegi să îl privești.
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

async function onboardBothPlatforms(
  page: Page,
  view: "together" | "separate",
  kilometers: "per_platform" | "shared" = "per_platform",
) {
  await expect(
    page.getByRole("heading", { name: "Ce tip de activitate faci?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continuă" }).click();
  await page.getByRole("button", { name: "Continuă" }).click();

  // Pasul platformelor.
  await page.getByRole("button", { name: /Bolt \+ Uber/ }).click();
  await expect(page.getByText("Cum dorești să vezi rezultatul?")).toBeVisible();
  await page
    .getByRole("button", {
      name: view === "separate" ? "Separat pe platformă" : "Împreună",
    })
    .click();

  await expect(page.getByText("Cum introduci kilometrii?")).toBeVisible();
  await page
    .getByRole("button", {
      name: kilometers === "shared" ? "Un singur total" : "Pe fiecare aplicație",
    })
    .click();
  await page.getByRole("button", { name: "Continuă" }).click();

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

async function fillBothPlatforms(page: Page) {
  const bolt = page.getByRole("group", { name: "Bolt", exact: true });
  await bolt.getByLabel("Plăți pentru curse în aplicație").fill("320");
  await bolt.getByLabel("Plăți pentru curse în numerar").fill("180");
  await bolt.getByLabel("Comision Bolt").fill("128.33");
  await bolt.getByLabel("Kilometri parcurși").fill("120");

  const uber = page.getByRole("group", { name: "Uber", exact: true });
  await uber.getByLabel("Plăți pentru curse în aplicație").fill("210");
  await uber.getByLabel("Plăți pentru curse în numerar").fill("95");
  await uber.getByLabel("Comision Uber").fill("79.61");
  await uber.getByLabel("Kilometri parcurși").fill("60");

  await page.getByLabel("Câte ore ai lucrat azi?").fill("9");
  await page.getByLabel("Prețul din ziua respectivă / litru").fill("7.2");
}

/** Rezultatul zilei, citit din cardul mare. */
async function dayResult(page: Page) {
  return (await page.locator(".result-value").innerText()).trim();
}

test("fiecare platformă are propriile câmpuri și propriul comision", async ({ page }) => {
  await page.goto("/");
  await createDemoAccount(page);
  await onboardBothPlatforms(page, "separate");

  // Două grupuri distincte, nu unul combinat.
  await expect(page.getByRole("group", { name: "Bolt", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Uber", exact: true })).toBeVisible();

  // Cât timp o singură aplicație are comisionul completat, ziua nu se
  // calculează: comisionul exact este obligatoriu pentru fiecare platformă.
  await page
    .getByRole("group", { name: "Bolt", exact: true })
    .getByLabel("Comision Bolt")
    .fill("128.33");
  await expect(page.getByText("Calculul nu este gata")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Salvează ziua în săptămână" }),
  ).toBeDisabled();

  await page
    .getByRole("group", { name: "Uber", exact: true })
    .getByLabel("Comision Uber")
    .fill("79.61");
  await expect(page.getByText("Îți rămân azi")).toBeVisible();
});

test("kilometrii zilei sunt suma celor două platforme", async ({ page }) => {
  await page.goto("/");
  await createDemoAccount(page);
  await onboardBothPlatforms(page, "separate");
  await fillBothPlatforms(page);

  await expect(page.getByText("180 km", { exact: true })).toBeVisible();

  // 180 km × 8,5 l/100 km × 7,20 RON = 110,16 RON, calculat o singură dată.
  await expect(
    page.locator(".calculation-preview").getByText("110,16 RON", { exact: true }),
  ).toBeVisible();
});

test("modul separat arată defalcarea, modul împreună nu", async ({ page }) => {
  await page.goto("/");
  await createDemoAccount(page);
  await onboardBothPlatforms(page, "separate");
  await fillBothPlatforms(page);

  const breakdown = page.locator(".platform-breakdown-card");
  await expect(breakdown).toBeVisible();
  await expect(breakdown.getByLabel("Detalii Bolt")).toBeVisible();
  await expect(breakdown.getByLabel("Detalii Uber")).toBeVisible();

  // Câștigul net și numerarul fiecărei aplicații rămân separate.
  await expect(breakdown.getByLabel("Detalii Bolt")).toContainText("371,67 RON");
  await expect(breakdown.getByLabel("Detalii Uber")).toContainText("225,39 RON");
  await expect(breakdown.getByLabel("Detalii Bolt")).toContainText("180,00 RON");

  // Bolt a făcut de două ori mai mulți kilometri, deci suportă dublul
  // combustibilului: 73,44 RON față de 36,72 RON, în total exact 110,16 RON.
  await expect(breakdown.getByLabel("Detalii Bolt")).toContainText("73,44 RON");
  await expect(breakdown.getByLabel("Detalii Uber")).toContainText("36,72 RON");
});

test("profitul zilei este identic în ambele moduri de vizualizare", async ({ page }) => {
  await page.goto("/");
  await createDemoAccount(page);
  await onboardBothPlatforms(page, "separate");
  await fillBothPlatforms(page);

  const separat = await dayResult(page);
  await expect(page.locator(".platform-breakdown-card")).toBeVisible();

  // Aceleași cifre, dar cu rezultatul privit împreună.
  await clickTopAction(page, "Șterge datele de test");
  await createDemoAccount(page);
  await onboardBothPlatforms(page, "together");
  await fillBothPlatforms(page);

  const impreuna = await dayResult(page);
  await expect(page.locator(".platform-breakdown-card")).toHaveCount(0);

  expect(separat).toBe(impreuna);
});

test("modul „un singur total” cere kilometrii o dată, cu tot cu mersul în gol", async ({ page }) => {
  await page.goto("/");
  await createDemoAccount(page);
  await onboardBothPlatforms(page, "separate", "shared");

  // Kilometrii nu se mai cer pe fiecare aplicație.
  await expect(
    page.getByRole("group", { name: "Bolt", exact: true }).getByLabel("Kilometri parcurși"),
  ).toHaveCount(0);
  await expect(page.getByLabel("Câți kilometri ai parcurs azi în total?")).toBeVisible();

  const bolt = page.getByRole("group", { name: "Bolt", exact: true });
  await bolt.getByLabel("Plăți pentru curse în aplicație").fill("200");
  await bolt.getByLabel("Comision Bolt").fill("0");

  const uber = page.getByRole("group", { name: "Uber", exact: true });
  await uber.getByLabel("Plăți pentru curse în aplicație").fill("100");
  await uber.getByLabel("Comision Uber").fill("0");

  // 200 km reali, nu 180 cât ar arăta aplicațiile: diferența este mersul în gol.
  await page.getByLabel("Câți kilometri ai parcurs azi în total?").fill("200");
  await page.getByLabel("Prețul din ziua respectivă / litru").fill("7.2");

  // 200 × 8,5 / 100 × 7,20 = 122,40 RON, calculat pe totalul real.
  await expect(
    page.locator(".calculation-preview").getByText("122,40 RON", { exact: true }),
  ).toBeVisible();

  // Bolt aduce exact dublul lui Uber, deci ia două treimi din kilometri.
  const breakdown = page.locator(".platform-breakdown-card");
  await expect(breakdown.getByLabel("Detalii Bolt")).toContainText("133,33 km");
  await expect(breakdown.getByLabel("Detalii Uber")).toContainText("66,67 km");
});

test("centralizarea săptămânii se defalcă pe platformă", async ({ page }) => {
  await page.goto("/");
  await createDemoAccount(page);
  await onboardBothPlatforms(page, "separate");

  await page.getByRole("button", { name: "Săptămânal" }).click();
  await expect(
    page.getByRole("heading", { name: /^Introdu totalul/ }),
  ).toBeVisible();

  // Și în formularul manual încasările se introduc pe fiecare aplicație.
  const bolt = page.getByRole("group", { name: "Bolt", exact: true });
  await bolt.getByLabel("Plăți pentru curse în aplicație").fill("1159");
  await bolt.getByLabel("Plăți pentru curse în numerar").fill("620.50");
  await bolt.getByLabel("Comision Bolt").fill("0");
  await bolt.getByLabel("Kilometri parcurși").fill("900");

  const uber = page.getByRole("group", { name: "Uber", exact: true });
  await uber.getByLabel("Plăți pentru curse în aplicație").fill("488.50");
  await uber.getByLabel("Plăți pentru curse în numerar").fill("305.75");
  await uber.getByLabel("Comision Uber").fill("0");
  await uber.getByLabel("Kilometri parcurși").fill("400");

  await page.getByLabel("Zile lucrate").fill("5");
  await page.getByLabel("Ore lucrate").fill("45");
  await page.getByLabel("Prețul pe litru folosit pentru perioadă").fill("7.2");
  await page.getByRole("button", { name: "Salvează săptămâna" }).click();

  const breakdown = page.locator(".platform-breakdown-card");
  await expect(breakdown).toBeVisible();
  await expect(breakdown.getByLabel("Detalii Bolt")).toContainText("1.779,50 RON");
  await expect(breakdown.getByLabel("Detalii Uber")).toContainText("794,25 RON");
  await expect(breakdown.getByLabel("Detalii Bolt")).toContainText("620,50 RON");
  await expect(breakdown.getByLabel("Detalii Bolt")).toContainText("900 km");
  await expect(breakdown.getByLabel("Detalii Uber")).toContainText("400 km");
});

test("în modul împreună, centralizarea nu arată defalcarea", async ({ page }) => {
  await page.goto("/");
  await createDemoAccount(page);
  await onboardBothPlatforms(page, "together");

  await page.getByRole("button", { name: "Săptămânal" }).click();
  const bolt = page.getByRole("group", { name: "Bolt", exact: true });
  await bolt.getByLabel("Plăți pentru curse în aplicație").fill("1159");
  await bolt.getByLabel("Plăți pentru curse în numerar").fill("620.50");
  await bolt.getByLabel("Comision Bolt").fill("0");
  await bolt.getByLabel("Kilometri parcurși").fill("900");

  const uber = page.getByRole("group", { name: "Uber", exact: true });
  await uber.getByLabel("Plăți pentru curse în aplicație").fill("488.50");
  await uber.getByLabel("Plăți pentru curse în numerar").fill("305.75");
  await uber.getByLabel("Comision Uber").fill("0");
  await uber.getByLabel("Kilometri parcurși").fill("400");

  await page.getByRole("button", { name: "Salvează săptămâna" }).click();
  await expect(page.getByRole("heading", { name: /introdus de tine/ })).toBeVisible();
  await expect(page.locator(".platform-breakdown-card")).toHaveCount(0);
});
