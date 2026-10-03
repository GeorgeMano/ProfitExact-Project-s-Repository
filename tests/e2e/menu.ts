import type { Page } from "@playwright/test";

/**
 * Apasă un buton din bara de sus. Pe telefon bara e strânsă în meniul
 * hamburger, așa că îl deschidem întâi, ca un utilizator real.
 */
export async function clickTopAction(page: Page, name: string | RegExp) {
  const visible = page.getByRole("button", { name, exact: typeof name === "string" }).filter({ visible: true });
  if ((await visible.count()) === 0) {
    await page.getByRole("button", { name: /^Meniul/ }).click();
    await page.getByRole("navigation", { name: /^Meniul/ }).getByRole("button", { name }).first().click();
    return;
  }
  await visible.first().click();
}
