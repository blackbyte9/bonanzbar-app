import { expect, test, type Page } from "@playwright/test";

async function signInDemo(page: Page, role: "ADMINISTRATION" | "BARLEITUNG" | "MITGLIED" | "GAST") {
  await page.goto("/");
  await page.getByRole("button", { name: new RegExp(`^${role}`, "i") }).click();
  await expect(page.getByRole("button", { name: /abmelden/i })).toBeVisible();
  await page.locator(".welcome-screen").waitFor({ state: "hidden" });
}

async function openDashboardSection(page: Page, title: RegExp) {
  await page.getByRole("button", { name: title }).first().click();
  await expect(page.getByRole("button", { name: "← HAUPTMENÜ" })).toBeVisible();
}

test.describe("Dashboard-Nutzerwege", () => {
  test("Barleitung sieht offene Korrekturen im Betrieb", async ({ page }) => {
    await signInDemo(page, "BARLEITUNG");
    await openDashboardSection(page, /korrekturen/i);

    await expect(page.getByRole("heading", { name: "Korrekturanfragen" })).toBeVisible();
    await expect(page.getByText(/mia mitglied · tannenzäpfle/i)).toBeVisible();
    await expect(page.getByLabel(/Zu stornierende Getränke/)).toBeVisible();
  });

  test("Mitglied sieht bestätigte Dienste und einheitliche Notiz-Tags", async ({ page }) => {
    await signInDemo(page, "MITGLIED");
    await openDashboardSection(page, /programm/i);

    await expect(page.getByRole("heading", { name: "Bestätigte Termine" })).toBeVisible();
    await expect(page.locator(".confirmed-event-card .status-tag.is-success")).toHaveText("Bestätigt");

    await page.getByRole("button", { name: /hauptmenü/i }).click();
    await openDashboardSection(page, /crew-notizen/i);
    await expect(page.locator(".status-tag.is-accent")).toHaveText("Angeheftet");
  });

  test("Gast sieht keine internen Veröffentlichungs- oder Löschaktionen", async ({ page }) => {
    await signInDemo(page, "GAST");
    await openDashboardSection(page, /programm/i);
    await expect(page.locator(".event-status")).toHaveCount(0);

    await page.getByRole("button", { name: /hauptmenü/i }).click();
    await openDashboardSection(page, /social wall/i);
    await expect(page.getByRole("button", { name: "Löschen" })).toHaveCount(0);
  });

  test("Social-Wall-Bilder öffnen innerhalb der Anwendung", async ({ page }) => {
    await signInDemo(page, "BARLEITUNG");
    await openDashboardSection(page, /social wall/i);

    await page.getByRole("button", { name: /bild ansehen/i }).click();
    await expect(page.getByRole("dialog", { name: "Bildvorschau" })).toBeVisible();
    await page.getByRole("button", { name: /bild schließen/i }).click();
    await expect(page.getByRole("dialog", { name: "Bildvorschau" })).toHaveCount(0);
  });
});

test.describe("Mobile Dashboard", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("bietet zwei Kachelspalten, Bereichsfilter und keinen horizontalen Überlauf", async ({ page }) => {
    await signInDemo(page, "BARLEITUNG");

    const menus = page.locator(".action-menu");
    await expect(menus.first()).toBeVisible();
    await expect.poll(() => menus.evaluateAll((elements) => elements.every((element) => element.children.length <= 6))).toBe(true);
    await expect.poll(() => menus.first().evaluate((element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length)).toBe(2);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const navigation = page.locator(".dashboard-filter-nav");
    await expect(navigation).toBeVisible();
    await navigation.getByRole("button", { name: "Betrieb" }).click();
    await expect(navigation.getByRole("button", { name: "Betrieb" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /bestand/i })).toBeVisible();
  });
});
