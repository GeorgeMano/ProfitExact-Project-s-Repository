import { expect, test, type Page } from "@playwright/test";

// Aplicația se folosește mai ales pe telefon: verificăm de la cel mai mic
// telefon până la laptop că nimic nu iese din ecran și că meniul merge.
const ecrane = [
  { nume: "telefon mic", width: 320, height: 640 },
  { nume: "telefon", width: 390, height: 844 },
  { nume: "tabletă", width: 768, height: 1024 },
  { nume: "laptop", width: 1366, height: 768 },
];

async function nimicInAfaraEcranului(page: Page, unde: string) {
  const { scroll, width, fontMic } = await page.evaluate(() => {
    const vizibil = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const campuri = [...document.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea")].filter(vizibil);
    return {
      scroll: document.documentElement.scrollWidth,
      width: document.documentElement.clientWidth,
      // Sub 16px, iPhone-ul mărește pagina când apeși pe câmp.
      fontMic: window.innerWidth <= 900 ? campuri.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).length : 0,
    };
  });
  expect(scroll, `${unde}: pagina iese din ecran`).toBeLessThanOrEqual(width);
  expect(fontMic, `${unde}: câmpuri cu scris prea mic`).toBe(0);
}

async function continua(page: Page) {
  await page.getByRole("button", { name: "Continuă" }).click();
}

for (const ecran of ecrane) {
  test(`arată corect pe ${ecran.nume} (${ecran.width}px)`, async ({ page }) => {
    await page.setViewportSize({ width: ecran.width, height: ecran.height });
    const peTelefon = ecran.width <= 900;

    await page.goto("/");
    await nimicInAfaraEcranului(page, "prima pagină");
    const meniuPagina = page.getByRole("button", { name: "Meniul paginii" });
    if (peTelefon) {
      await meniuPagina.click();
      const nav = page.getByRole("navigation", { name: "Meniul paginii" });
      await expect(nav).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(nav).toBeHidden();
      await meniuPagina.click();
      await nav.getByRole("button", { name: "Creează cont gratuit" }).click();
    } else {
      await expect(meniuPagina).toBeHidden();
      await page.getByRole("button", { name: "Creează cont gratuit" }).first().click();
    }

    await page.getByLabel("Adresă de email").fill(`ecran${ecran.width}@profitexact.test`);
    await page.getByLabel("Parolă", { exact: true }).fill("profitexact123");
    await page.getByLabel("Confirmă parola").fill("profitexact123");
    await page.getByRole("button", { name: "Creează contul" }).click();
    await page.getByLabel("Cod primit pe email").fill("123456");
    await page.getByRole("button", { name: "Verifică emailul" }).click();
    await nimicInAfaraEcranului(page, "configurare");

    await continua(page);
    await continua(page);
    await continua(page);
    await page.getByLabel("Orașul principal în care lucrezi").fill("Pitesti");
    await continua(page);
    await continua(page);
    await page.getByLabel("Valoare comision").fill("10");
    await continua(page);
    await page.getByLabel("Consum aproximativ").fill("8");
    await continua(page);
    await page.getByRole("button", { name: "Confirmă configurația" }).click();

    await page.getByLabel("Plăți pentru curse în aplicație").fill("545");
    await page.getByLabel("Plăți pentru curse în numerar").fill("400");
    await page.getByLabel("Comision Bolt").fill("200");
    await page.getByLabel("Kilometri parcurși").fill("180");
    await nimicInAfaraEcranului(page, "ziua");

    const bara = page.locator(".mobile-result-bar");
    const calcul = page.locator("#calcul");
    if (peTelefon) {
      // Rezultatul stă mereu jos, iar calculul complet e la un buton distanță.
      await expect(bara).toBeVisible();
      await expect(bara).toContainText("Rezultat azi");
      await bara.getByRole("button", { name: "Vezi calculul" }).click();
      await expect(calcul).toBeInViewport();
      await expect(page.getByText("Regularizarea zilei")).toBeVisible();

      await page.getByRole("button", { name: "Meniul aplicației" }).click();
      await page.getByRole("navigation", { name: "Meniul aplicației" }).getByRole("button", { name: /^Săptămânal/ }).click();
      await expect(page.getByRole("navigation", { name: "Meniul aplicației" })).toBeHidden();
    } else {
      await expect(bara).toBeHidden();
      await expect(calcul).toBeVisible();
      await page.getByRole("button", { name: "Săptămânal" }).click();
    }
    await expect(page.getByRole("heading", { name: /săptămânii|Introdu totalul/ }).first()).toBeVisible();
    await nimicInAfaraEcranului(page, "săptămâna");
  });
}
