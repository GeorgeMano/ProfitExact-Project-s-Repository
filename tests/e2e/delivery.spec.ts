import { expect, test, type Page } from "@playwright/test";

async function createAccount(page: Page, email: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Creează cont gratuit" }).first().click();
  await page.getByLabel("Adresă de email").fill(email);
  await page.getByLabel("Parolă", { exact: true }).fill("profitexact123");
  await page.getByLabel("Confirmă parola").fill("profitexact123");
  await page.getByRole("button", { name: "Creează contul" }).click();
  await page.getByLabel("Cod primit pe email").fill("123456");
  await page.getByRole("button", { name: "Verifică emailul" }).click();
}

const next = (page: Page) => page.getByRole("button", { name: "Continuă" }).click();

test("curier angajat la flotă, pe Glovo și Wolt, cu bicicleta", async ({ page }) => {
  await createAccount(page, "curier@profitexact.test");

  await page.getByRole("button", { name: /^Delivery/ }).click();
  await next(page);
  await expect(page.getByRole("heading", { name: "Cum lucrezi pentru delivery?" })).toBeVisible();
  await next(page);

  // Fără nicio aplicație aleasă nu se poate continua.
  await expect(page.getByRole("heading", { name: "Pe ce aplicații livrezi?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuă" })).toBeDisabled();
  await page.getByRole("button", { name: /^Glovo/ }).click();
  await page.getByRole("button", { name: /^Wolt/ }).click();
  await expect(page.getByText("Cum dorești să vezi rezultatul?")).toBeVisible();
  await next(page);

  await page.getByLabel("Orașul principal în care lucrezi").fill("Cluj-Napoca");
  await next(page);

  await expect(page.getByRole("heading", { name: "Cu ce livrezi?" })).toBeVisible();
  await page.getByRole("button", { name: /^Bicicletă Fără combustibil/ }).click();
  await next(page);

  // Flota: exact ca la ridesharing.
  await page.getByLabel("Valoare comision").fill("10");
  await page.getByLabel("Plătești CIM/carte de muncă prin flotă?").check();
  await page.getByLabel("Cost pe săptămână").fill("700");
  await next(page);

  // La bicicletă nu se cere consum și nici RCA.
  await expect(page.getByText("La bicicletă nu există combustibil", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Consum aproximativ")).toHaveCount(0);
  await expect(page.getByLabel("RCA anual")).toHaveCount(0);
  await next(page);

  await expect(page.getByText("Delivery · Angajat")).toBeVisible();
  await expect(page.getByText("Glovo + Wolt")).toBeVisible();
  await expect(page.getByText("Bicicletă · al meu")).toBeVisible();
  await page.getByRole("button", { name: "Confirmă configurația" }).click();

  const glovo = page.getByRole("group", { name: "Glovo", exact: true });
  const wolt = page.getByRole("group", { name: "Wolt", exact: true });
  // Aplicațiile de livrări nu au comision.
  await expect(glovo.getByLabel("Comision Glovo")).toHaveCount(0);
  await expect(glovo.getByRole("button", { name: "Încarcă captura" })).toBeVisible();

  // Glovo, în ordinea ecranului „Payments”.
  const glovoLabels = await glovo.locator(".earnings-label").allTextContents();
  expect(glovoLabels.slice(0, 5)).toEqual([
    "Venit totalTotal income",
    "Medie pe orăAverage per hour, calculată",
    "Ore onlineHours online",
    "Livrări finalizateCompleted",
    "Livrări anulateCancelled",
  ]);
  await glovo.getByLabel("Venit total").fill("330");
  await glovo.getByLabel("Ore online").fill("10");
  await expect(glovo.locator(".earnings-computed")).toHaveText("33,00 RON");
  await wolt.getByLabel("Câștiguri fără bacșiș").fill("170");

  await expect(page.getByLabel(/Prețul din ziua respectivă/)).toHaveCount(0);
  await expect(page.getByText("Ai spălat mașina azi?")).toHaveCount(0);

  // 500 încasări − 10% comision flotă (50) − CIM 700/7 (100) = 350.
  await expect(page.locator(".result-value")).toHaveText("350,00 RON");
  const details = page.locator(".breakdown-card").first();
  await expect(details.getByText("Comision aplicație")).toHaveCount(0);
  await expect(details.getByText("Combustibil / energie")).toHaveCount(0);
  await expect(details.getByText("Comision flotă")).toBeVisible();
  await expect(page.getByText("Regularizarea zilei")).toBeVisible();
});

test("SRL de delivery cu scuter și contract de afiliere", async ({ page }) => {
  await createAccount(page, "srl-livrari@profitexact.test");

  await page.getByRole("button", { name: /^Delivery/ }).click();
  await next(page);
  await page.getByRole("button", { name: /Propriul SRL\/PFA/ }).click();
  await page.getByRole("button", { name: "SRL", exact: true }).click();
  await page.getByRole("button", { name: "Microîntreprindere" }).click();
  await next(page);
  await page.getByRole("button", { name: /^Bolt Food/ }).click();
  await next(page);
  await page.getByLabel("Orașul principal în care lucrezi").fill("Iasi");
  await next(page);
  await page.getByRole("button", { name: /^Scuter \/ motocicletă/ }).click();
  await next(page);

  // La delivery nu există costuri ARR; apare contractul de afiliere.
  await expect(page.getByText("Costuri ARR pentru transport alternativ")).toHaveCount(0);
  await expect(page.getByText("Costuri casă de marcat")).toHaveCount(0);
  await page.getByLabel("Beneficiezi de un contract de afiliere?").check();
  await page.locator(".conditional-cost", { hasText: "contract de afiliere" }).getByRole("textbox").fill("10");
  await next(page);

  await expect(page.getByLabel("Adaugi rovinieta?")).toHaveCount(0);
  await page.getByLabel("Consum aproximativ").fill("3");
  await next(page);

  await expect(page.getByText("Delivery · Propriul SRL")).toBeVisible();
  await expect(page.getByText("10% din încasări")).toBeVisible();
  await page.getByRole("button", { name: "Confirmă configurația" }).click();

  await page.getByLabel("Câștig din livrări").fill("400");
  await expect(page.locator(".earnings-cash-pill.card")).toHaveText(/Bani în contul firmei/);

  const details = page.locator(".breakdown-card").first();
  await expect(details.getByText("Comision afiliere")).toBeVisible();
  await expect(details.getByText("Comision flotă")).toHaveCount(0);
  await expect(page.locator(".result-label")).toHaveText("Îți rămân azi, înainte de taxe");
  await expect(page.getByText("Regularizarea zilei")).toHaveCount(0);
});

test("trecerea de la ridesharing la delivery nu amestecă datele", async ({ page }) => {
  await createAccount(page, "schimbare@profitexact.test");

  // Ridesharing, cu o zi salvată.
  await next(page);
  await next(page);
  await next(page);
  await page.getByLabel("Orașul principal în care lucrezi").fill("Pitesti");
  await next(page);
  await next(page);
  await page.getByLabel("Valoare comision").fill("10");
  await next(page);
  await page.getByLabel("Consum aproximativ").fill("6");
  await next(page);
  await page.getByRole("button", { name: "Confirmă configurația" }).click();
  await page.getByLabel("Plăți pentru curse în aplicație").fill("803.90");
  await page.getByLabel("Comision Bolt").fill("100");
  await page.getByRole("button", { name: "Salvează ziua în săptămână" }).click();
  await expect(page.locator(".weekly-metrics")).toBeVisible();

  // Același cont trece pe delivery: ziua de Bolt nu apare în calcul.
  await page.getByRole("button", { name: "Modifică configurarea" }).click();
  await page.getByRole("button", { name: /^Delivery/ }).click();
  await next(page);
  await next(page);
  await page.getByRole("button", { name: /^Glovo/ }).click();
  await next(page);
  await page.getByLabel("Orașul principal în care lucrezi").fill("Pitesti");
  await next(page);
  await page.getByRole("button", { name: /^Bicicletă Fără combustibil/ }).click();
  await next(page);
  await page.getByLabel("Valoare comision").fill("10");
  await next(page);
  await next(page);
  await page.getByRole("button", { name: "Confirmă configurația" }).click();

  await expect(page.getByRole("heading", { name: "Nicio zi salvată încă" })).toBeVisible();
  await page.getByRole("button", { name: "Săptămânal" }).click();
  await expect(page.getByText("803,90")).toHaveCount(0);
});

test("„Ambele”: Bolt și Glovo, comision diferit la livrări și rezultatul pe activități", async ({ page }) => {
  await createAccount(page, "ambele@profitexact.test");

  await page.getByRole("button", { name: /^Ambele/ }).click();
  await next(page);
  await expect(page.getByRole("heading", { name: "Cum lucrezi?" })).toBeVisible();
  await next(page);

  // Bolt (implicit) și, dedesubt, aplicațiile de livrări.
  await expect(page.getByText("Și pe ce aplicații livrezi?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuă" })).toBeDisabled();
  await page.getByRole("button", { name: /^Glovo/ }).click();
  await page.getByRole("button", { name: "Separat pe platformă" }).click();
  await next(page);
  await page.getByLabel("Orașul principal în care lucrezi").fill("Pitesti");
  await next(page);
  // Aceeași mașină pentru ambele.
  await expect(page.getByRole("heading", { name: "Mașina este personală sau închiriată?" })).toBeVisible();
  await next(page);

  await page.getByLabel("Valoare comision").fill("10");
  await page.getByLabel("Flota ia alt comision la livrări?").check();
  await page.getByRole("textbox", { name: /^Comision la livrări/ }).fill("20");
  await page.getByLabel("Plătești CIM/carte de muncă prin flotă?").check();
  await page.getByLabel("Cost pe săptămână").fill("70");
  await next(page);
  await page.getByLabel("Consum aproximativ").fill("8");
  await next(page);

  await expect(page.getByText("Ridesharing + Delivery · Angajat")).toBeVisible();
  await expect(page.getByText("Bolt + Glovo")).toBeVisible();
  await expect(page.getByText("Comision flotă la livrări")).toBeVisible();
  await page.getByRole("button", { name: "Confirmă configurația" }).click();

  const bolt = page.getByRole("group", { name: "Bolt", exact: true });
  const glovo = page.getByRole("group", { name: "Glovo", exact: true });
  await bolt.getByLabel("Plăți pentru curse în aplicație").fill("120");
  await bolt.getByLabel("Comision Bolt").fill("20");
  await bolt.getByLabel("Kilometri parcurși").fill("150");
  await glovo.getByLabel("Venit total").fill("50");
  await glovo.getByLabel("Kilometri parcurși").fill("50");

  // 150 încasări − comision (10% din 100 + 20% din 50 = 20) − CIM 70/7 = 120.
  await expect(page.locator(".result-value")).toHaveText("120,00 RON");
  const split = page.locator(".activity-split-card");
  // Costurile comune (CIM, 10 lei) după km: 75% ridesharing, 25% delivery.
  await expect(split.getByText(/^Ridesharing · 150 km$/)).toBeVisible();
  await expect(split).toContainText("82,50 RON");
  await expect(split).toContainText("37,50 RON");
  await expect(split).toContainText("75% ridesharing, 25% delivery");
});
