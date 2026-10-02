import { describe, expect, it } from "vitest";
import { emptyPlatformEntry, platformEntryTotals } from "@/lib/finance/platform-entry";
import { detectPeriod, entryFromReading, parseEarningsScreenshot } from "./earnings-screenshot";

/**
 * Textul citit efectiv de OCR din fotografia ecranului Bolt (săptămâna
 * 31 aug. – 6 sept.), cu tot cu zgomotul de pe margini.
 */
const BOLT_WEEK = `E LWCIdiCAI CA CAtUSII ME
Zilnic Săptămânal Lunar
< 31 aug. - 6 sept.
Venituri în aplicaţie +856,90 lei e
Plăţi pentru curse +803,90 lei
| Campanii +9,00 lei
Taxe de anulare +24,00 lei
Bacșiș +20,00 lei
Venituri în numerar +764,60 lei
Plăţi pentru curse +566,30 lei
Credite și promoții pentru +198,30 lei
utilizatori
Costuri și taxe 0,00 lei
Comision Bolt -395,72 lei _
Câștigurile tale 1.225,78 lei
Numerar în mână +566,30 lei >
Eu i`;

/** Aceeași imagine, citită fără pregătire: alt zgomot, aceleași cifre. */
const BOLT_WEEK_RAW = `d LDCTdiCAI CA LCĂpti YA SE
Zinic “Săptămânal Lunar
< 31 aug. - 6 sept.
Venituri în aplicaţie +856,90 lei E
Plăţi pentru curse +803,90 lei
| Campanii +9,00 lei
Taxe de anulare +24,00 lei
Bacșiș +20,00 lei
Venituri în numerar +764,60 lei
Plăţi pentru curse +566,30 lei
Credite și promoții pentru +198,30 lei
utilizatori
Costuri și taxe 0,00 lei
Comision Bolt -395,72 lei or”
Câștigurile tale 1.225,78 lei
Numerar în mână +566,30 lei >
: X _ E a`;

describe("citirea ecranului „Defalcarea câștigurilor”", () => {
  it("pune fiecare sumă în rubrica ei", () => {
    const reading = parseEarningsScreenshot(BOLT_WEEK);

    expect(reading.recognized).toBe(true);
    expect(reading.values).toEqual({
      appRidePayments: 803.9,
      campaigns: 9,
      cancellationFees: 24,
      appTips: 20,
      cashRidePayments: 566.3,
      userCredits: 198.3,
      platformCosts: 0,
      applicationCommission: 395.72,
    });
    expect(reading.totals).toEqual({
      appRevenue: 856.9,
      cashRevenue: 764.6,
      netEarnings: 1225.78,
      cashInHand: 566.3,
    });
  });

  it("confirmă că cifrele se leagă între ele, ca în aplicație", () => {
    const reading = parseEarningsScreenshot(BOLT_WEEK);

    expect(reading.problems).toEqual([]);
    expect(reading.needsCheck).toEqual([]);
  });

  it("dă același rezultat și din imaginea nepregătită", () => {
    expect(parseEarningsScreenshot(BOLT_WEEK_RAW).values).toEqual(
      parseEarningsScreenshot(BOLT_WEEK).values,
    );
  });

  it("completează formularul cu aceleași totaluri ca în Bolt", () => {
    const entry = entryFromReading(emptyPlatformEntry("bolt"), parseEarningsScreenshot(BOLT_WEEK));
    const totals = platformEntryTotals(entry);

    expect(totals.netEarnings).toBe(1225.78);
    expect(totals.cashInHand).toBe(566.3);
    expect(entry.applicationCommission).toBe(395.72);
  });

  it("marchează rubricile de verificat când o cifră e citită greșit", () => {
    // OCR-ul a citit 863,90 în loc de 803,90.
    const reading = parseEarningsScreenshot(BOLT_WEEK.replace("+803,90", "+863,90"));

    expect(reading.needsCheck).toContain("appRidePayments");
    expect(reading.problems[0]).toMatch(/Venituri în aplicație/);
  });

  it("cere comisionul când nu a putut fi citit", () => {
    const reading = parseEarningsScreenshot(BOLT_WEEK.replace(/Comision Bolt.*\n/, ""));

    expect(reading.values.applicationCommission).toBeUndefined();
    expect(reading.needsCheck).toContain("applicationCommission");
  });

  it("nu șterge ce era completat când totalurile nu se verifică", () => {
    const current = { ...emptyPlatformEntry("bolt"), campaigns: 15 };
    const reading = parseEarningsScreenshot(
      BOLT_WEEK.replace(/\| Campanii.*\n/, "").replace("+803,90", "+863,90"),
    );

    expect(entryFromReading(current, reading).campaigns).toBe(15);
  });

  it("recunoaște sumele și fără diacritice sau cu semne citite altfel", () => {
    const reading = parseEarningsScreenshot(
      [
        "Venituri in aplicatie + 1.020,00 lei",
        "Plati pentru curse 1.000,00 lei",
        "Bacsis 20,00 lei",
        "Venituri in numerar 0,00 lei",
        "Comision Bolt – 250,00 lei",
        "Castigurile tale 770,00 lei",
      ].join("\n"),
    );

    expect(reading.values.appRidePayments).toBe(1000);
    expect(reading.values.appTips).toBe(20);
    expect(reading.values.applicationCommission).toBe(250);
    expect(reading.problems).toEqual([]);
  });

  it("spune că nu a recunoscut o imagine fără ecranul de câștiguri", () => {
    expect(parseEarningsScreenshot("Bon fiscal\nTotal 100").recognized).toBe(false);
  });
});

describe("perioada scrisă în captură", () => {
  it("găsește săptămâna din antet", () => {
    expect(parseEarningsScreenshot(BOLT_WEEK, "2026-10-02").period).toEqual({
      startDate: "2026-08-31",
      endDate: "2026-09-06",
    });
  });

  it("găsește și o săptămână în aceeași lună", () => {
    expect(detectPeriod("< 14 - 20 sept.", "2026-10-02")).toEqual({
      startDate: "2026-09-14",
      endDate: "2026-09-20",
    });
  });

  it("găsește o singură zi", () => {
    expect(detectPeriod("Zilnic\n< 1 oct. >", "2026-10-02")).toEqual({
      startDate: "2026-10-01",
      endDate: "2026-10-01",
    });
  });

  it("alege anul trecut pentru o dată care altfel ar fi în viitor", () => {
    expect(detectPeriod("< 29 dec. - 4 ian.", "2027-01-10")).toEqual({
      startDate: "2026-12-29",
      endDate: "2027-01-04",
    });
    expect(detectPeriod("< 15 - 21 dec.", "2026-10-02")).toEqual({
      startDate: "2025-12-15",
      endDate: "2025-12-21",
    });
  });

  it("nu inventează o perioadă când nu există", () => {
    expect(detectPeriod("Comision Bolt -395,72 lei", "2026-10-02")).toBeNull();
  });
});
