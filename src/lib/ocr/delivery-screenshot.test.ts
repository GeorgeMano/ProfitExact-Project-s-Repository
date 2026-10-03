import { describe, expect, it } from "vitest";
import { emptyPlatformEntry } from "@/lib/finance/platform-entry";
import { entryFromDeliveryReading, parseDeliveryScreenshot, planDeliveryCapture } from "./delivery-screenshot";

/** Textul citit efectiv de OCR din capturi reale Wolt („Statisticile tale”). */
const WOLT_LUNA = `20:47 1 ul E
— o
o o o
Statisticile tale
Azi Săptămâna Luna Personalizat

Septembrie
Livrări finalizate 2
Distanța parcursă în timpul
comenzii și în afara 11.9 km
acesteia.
Câștiguri (estimare) 21,10 RON`;

const WOLT_SAPTAMANA = `Statisticile tale
Azi Săptămâna Luna Personalizat

31 aug - 3 sep
Livrări finalizate 4
Distanța parcursă în timpul
comenzii și în afara 36 km
acesteia.
Câștiguri (estimare) 44,10 RON`;

const WOLT_AZI = `20:47 %& al S a
Statisticile tale
Azi Săptămâna Luna Personalizat

3 septembrie
Livrări finalizate 0
Distanța parcursă în timpul
comenzii și în afara O km
acesteia.
Câștiguri (estimare) —`;

const WOLT_PERSONALIZAT = `20:24 1 „ul LE
Statisticile tale
Azi Săptămâna Luna | Personalizat j
De la lun 03/08/2026 (6
La joi 03/09/2026 (6
12 luni interval maxim
Caută

Livrări finalizate 10
Distanța parcursă în timpul
comenzii și în afara 82.9 km
acesteia.
Câștiguri (estimare) 125,00 RON
Câștiguri fără bacșiș 119,00 RON
Bacșiș 6,00 RON`;

/** Textul citit din lista Bolt Food „Toate livrările” (virgule pierdute de OCR). */
const BOLTFOOD_LISTA = `20:55 1 || GE 51)

— Toate livrările

15 iulie 2026 24,00 RON
Livrări: 2

Burger King Pitesti Shopping Park DT 1132 RON

15.07, 15:45, H9Y035 '

losua Fast Food 12 68 RON

15.07, 14:50, ER9ZHA :

14 iulie 2026 30,99 RON
Livrări: 2

Shaorma Amicii Pitesti 2121RON

14.07, 16:31, HAKBAP :

Hesburger Pitești Retail Park 978 RON

14.07, 15:28, HZ4ZSX :

3 iulie 2026 52,73 RON
Livrări: 3

Carrefour Pitesti 2 (6114) 24 64 RON

03.07, 16:46, H6X3RV

Shaorma Amicii Pitesti 10.92 RON

03.07, 16:09, H21W20 :

Mr. Crispy & Pizza 1717 RON

03.07, 15:51, RE3FTW !

1iulie 2026 55,78 RON
Livrări: 4

Burger King Pitesti Shopping Park DT 14 64 RON

MAI D010 LICNIRY i`;

const TODAY = "2026-10-02";

describe("Wolt — „Statisticile tale”", () => {
  it("citește livrările, distanța și câștigurile lunii", () => {
    const reading = parseDeliveryScreenshot(WOLT_LUNA, TODAY);

    expect(reading.platform).toBe("wolt");
    expect(reading.deliveries).toBe(2);
    expect(reading.values).toEqual({ kilometers: 11.9, appRidePayments: 21.1 });
    expect(reading.period).toEqual({ startDate: "2026-09-01", endDate: "2026-09-30", kind: "month" });
    expect(reading.problems).toEqual([]);
  });

  it("recunoaște săptămâna, chiar dacă e afișată doar până azi", () => {
    const reading = parseDeliveryScreenshot(WOLT_SAPTAMANA, TODAY);

    expect(reading.period).toEqual({ startDate: "2026-08-31", endDate: "2026-09-06", kind: "week" });
    expect(reading.values).toEqual({ kilometers: 36, appRidePayments: 44.1 });
    expect(reading.deliveries).toBe(4);
  });

  it("o zi fără livrări: „O km” și câștiguri „—” înseamnă zero", () => {
    const reading = parseDeliveryScreenshot(WOLT_AZI, TODAY);

    expect(reading.period).toEqual({ startDate: "2026-09-03", endDate: "2026-09-03", kind: "day" });
    expect(reading.values).toEqual({ kilometers: 0, appRidePayments: 0 });
    expect(reading.problems).toEqual([]);
  });

  it("la „Personalizat” separă bacșișul și verifică totalul", () => {
    const reading = parseDeliveryScreenshot(WOLT_PERSONALIZAT, TODAY);

    expect(reading.values).toEqual({ kilometers: 82.9, appRidePayments: 119, appTips: 6 });
    expect(reading.total).toBe(125);
    expect(reading.problems).toEqual([]);
    expect(reading.period).toEqual({ startDate: "2026-08-03", endDate: "2026-09-03", kind: "custom" });
  });

  it("marchează rubricile când bacșișul și restul nu dau totalul", () => {
    const reading = parseDeliveryScreenshot(WOLT_PERSONALIZAT.replace("119,00", "179,00"), TODAY);

    expect(reading.needsCheck).toEqual(["appRidePayments", "appTips"]);
    expect(reading.problems[0]).toMatch(/dau 185\.00, dar totalul citit este 125\.00/);
  });
});

describe("Bolt Food — „Toate livrările”", () => {
  it("găsește fiecare zi cu totalul și numărul de livrări", () => {
    const reading = parseDeliveryScreenshot(BOLTFOOD_LISTA, TODAY);

    expect(reading.platform).toBe("bolt_food");
    expect(reading.days.map(({ date, total, deliveries }) => ({ date, total, deliveries }))).toEqual([
      { date: "2026-07-15", total: 24, deliveries: 2 },
      { date: "2026-07-14", total: 30.99, deliveries: 2 },
      { date: "2026-07-03", total: 52.73, deliveries: 3 },
      { date: "2026-07-01", total: 55.78, deliveries: 4 },
    ]);
  });

  it("repară virgulele pierdute și confirmă cu totalul zilei", () => {
    const reading = parseDeliveryScreenshot(BOLTFOOD_LISTA, TODAY);

    expect(reading.days[0].amounts).toEqual([11.32, 12.68]);
    expect(reading.days[1].amounts).toEqual([21.21, 9.78]);
    expect(reading.days[2].amounts).toEqual([24.64, 10.92, 17.17]);
    // Ultima zi e tăiată în captură: o singură livrare din 4, dar totalul e citit.
    expect(reading.days[3].amounts).toEqual([14.64]);
    expect(reading.problems).toEqual([]);
  });

  it("semnalează o zi ale cărei livrări nu dau totalul", () => {
    const reading = parseDeliveryScreenshot(BOLTFOOD_LISTA.replace("2121RON", "2721RON"), TODAY);

    expect(reading.problems[0]).toMatch(/14\.07\.2026/);
  });

  it("completează ziua din formular cu totalul ei", () => {
    const reading = parseDeliveryScreenshot(BOLTFOOD_LISTA, TODAY);
    const entry = entryFromDeliveryReading(emptyPlatformEntry("bolt_food"), reading, {
      startDate: "2026-07-14",
      endDate: "2026-07-14",
      includeKilometers: true,
    });

    expect(entry.appRidePayments).toBe(30.99);
    expect(entry.deliveries).toBe(2);
  });

  it("adună zilele dintr-o săptămână", () => {
    const reading = parseDeliveryScreenshot(BOLTFOOD_LISTA, TODAY);
    const entry = entryFromDeliveryReading(emptyPlatformEntry("bolt_food"), reading, {
      startDate: "2026-07-13",
      endDate: "2026-07-19",
      includeKilometers: true,
    });

    expect(entry.appRidePayments).toBe(54.99);
    expect(entry.deliveries).toBe(4);
  });
});

describe("Bolt Food — „Performanță”", () => {
  it("citește livrările și distanța de deasupra etichetelor", () => {
    const reading = parseDeliveryScreenshot(
      `— Performanţă\nAstăzi Săptămână Lună\n87%\nRata de acceptare\n12\nLivrări finalizate\n41.30\nDistanţă parcursă (km)`,
      TODAY,
    );

    expect(reading.screen).toBe("boltfood_performance");
    expect(reading.deliveries).toBe(12);
    expect(reading.values.kilometers).toBe(41.3);
  });
});

it("spune că nu a recunoscut un ecran necunoscut", () => {
  expect(parseDeliveryScreenshot("Bon fiscal\nTotal 100", TODAY).recognized).toBe(false);
});

describe("unde merge captura", () => {
  const dayForm = { type: "day" as const, startDate: "2026-10-02", endDate: "2026-10-02" };

  it("perioada din captură are întâietate față de alegere", () => {
    const plan = planDeliveryCapture(parseDeliveryScreenshot(WOLT_SAPTAMANA, TODAY), "day", dayForm, "wolt", "Wolt");

    expect(plan).toMatchObject({ type: "target", period: "week", anchorDate: "2026-08-31" });
  });

  it("„Personalizat” merge la perioada aleasă, cu o precizare", () => {
    const plan = planDeliveryCapture(parseDeliveryScreenshot(WOLT_PERSONALIZAT, TODAY), "month", dayForm, "wolt", "Wolt");

    expect(plan).toMatchObject({ type: "target", period: "month", anchorDate: "2026-08-03" });
    expect(plan.type === "target" && plan.notes[0]).toMatch(/personalizată/);
  });

  it("din lista Bolt Food alege ziua formularului, dacă e în captură", () => {
    const reading = parseDeliveryScreenshot(BOLTFOOD_LISTA, TODAY);
    const form = { type: "day" as const, startDate: "2026-07-03", endDate: "2026-07-03" };

    expect(planDeliveryCapture(reading, "day", form, "bolt_food", "Bolt Food")).toMatchObject({ period: "day", anchorDate: "2026-07-03" });
    expect(planDeliveryCapture(reading, "day", dayForm, "bolt_food", "Bolt Food")).toMatchObject({ period: "day", anchorDate: "2026-07-15" });
  });

  it("refuză o captură din altă aplicație", () => {
    const plan = planDeliveryCapture(parseDeliveryScreenshot(WOLT_LUNA, TODAY), "month", dayForm, "bolt_food", "Bolt Food");

    expect(plan).toEqual({ type: "error", message: "Captura pare din altă aplicație, iar rubricile sunt pentru Bolt Food." });
  });
});

/** Textul citit de OCR din captura reală Glovo „Payments” (săptămână fără livrări). */
const GLOVO_SAPTAMANA = `07:051 al 5 «E
<« App Store
€ Payments
e Mon 28 Sep - Sun 4 Oct
2026
Total income
RON 0.00 O
Average per hour () Hours online ()
RON 0.00 Om
Deliveries >
O Completed : 0 Cancelled`;

describe("Glovo — „Payments”", () => {
  it("citește săptămâna cu anul de dedesubt și valorile de sub etichete", () => {
    const reading = parseDeliveryScreenshot(GLOVO_SAPTAMANA, TODAY);

    expect(reading.platform).toBe("glovo");
    expect(reading.period).toEqual({ startDate: "2026-09-28", endDate: "2026-10-04", kind: "week" });
    expect(reading.values.appRidePayments).toBe(0);
    expect(reading.hoursOnline).toBe(0);
    expect(reading.deliveries).toBe(0);
    expect(reading.cancelledDeliveries).toBe(0);
    expect(reading.problems).toEqual([]);
  });

  const busyWeek = GLOVO_SAPTAMANA
    .replace("RON 0.00 O\n", "RON 1,245.50 O\n")
    .replace("RON 0.00 Om", "RON 49.82 25h 0m")
    .replace("O Completed : 0 Cancelled", "61 Completed · 2 Cancelled");

  it("citește sume cu mii, ore și minute", () => {
    const reading = parseDeliveryScreenshot(busyWeek, TODAY);

    expect(reading.values.appRidePayments).toBe(1245.5);
    expect(reading.hoursOnline).toBe(25);
    expect(reading.deliveries).toBe(61);
    expect(reading.cancelledDeliveries).toBe(2);
    expect(reading.problems).toEqual([]);
  });

  it("verifică venitul cu media pe oră", () => {
    const reading = parseDeliveryScreenshot(busyWeek.replace("RON 1,245.50", "RON 1,845.50"), TODAY);

    expect(reading.needsCheck).toEqual(["appRidePayments", "hoursOnline"]);
    expect(reading.problems[0]).toMatch(/media citită este 49\.82/);
  });

  it("completează rubricile Glovo", () => {
    const entry = entryFromDeliveryReading(emptyPlatformEntry("glovo"), parseDeliveryScreenshot(busyWeek, TODAY), {
      startDate: "2026-09-28",
      endDate: "2026-10-04",
      includeKilometers: true,
    });

    expect(entry).toMatchObject({ appRidePayments: 1245.5, hoursOnline: 25, deliveries: 61, cancelledDeliveries: 2 });
  });
});
