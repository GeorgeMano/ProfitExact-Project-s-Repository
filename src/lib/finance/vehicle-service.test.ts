import { describe, expect, it } from "vitest";
import { estimateOdometer, serviceLog, serviceStatus, type DayServiceInfo, type VehicleServiceConfig } from "./vehicle-service";

const config: VehicleServiceConfig = {
  odometerKm: 187_400,
  odometerDate: "2026-10-01",
  lastServiceKm: 175_000,
  lastServiceDate: "2026-03-10",
  intervalKm: 15_000,
  intervalMonths: 12,
};

describe("kilometrajul estimat", () => {
  it("adaugă kilometrii de lucru de după citirea de la configurare", () => {
    const days: DayServiceInfo[] = [
      { date: "2026-09-30", kilometers: 999 }, // înainte de citire: nu contează
      { date: "2026-10-02", kilometers: 180 },
      { date: "2026-10-03", kilometers: 220 },
    ];
    expect(estimateOdometer(config, days, "2026-10-03")).toEqual({ km: 187_800, readingDate: "2026-10-01", kmSinceReading: 400 });
  });

  it("o citire nouă de la bord înlocuiește estimarea (prinde și drumurile personale)", () => {
    const days: DayServiceInfo[] = [
      { date: "2026-10-02", kilometers: 180 },
      { date: "2026-10-04", kilometers: 200, odometerKm: 188_100 },
      { date: "2026-10-05", kilometers: 150 },
    ];
    expect(estimateOdometer(config, days, "2026-10-05")?.km).toBe(188_250);
  });

  it("fără niciun kilometraj nu se estimează nimic", () => {
    expect(estimateOdometer(undefined, [{ date: "2026-10-02", kilometers: 100 }], "2026-10-02")).toBeNull();
  });
});

describe("alerta de revizie", () => {
  it("normal: arată la ce kilometraj urmează revizia", () => {
    const status = serviceStatus(config, [], "2026-10-01");
    expect(status.nextServiceKm).toBe(190_000);
    expect(status.kmLeft).toBe(2_600);
    expect(status.level).toBe("ok");
  });

  it("roșu când mai sunt sub 10% din interval", () => {
    const status = serviceStatus(config, [{ date: "2026-10-02", kilometers: 1_200 }], "2026-10-02");
    expect(status.kmLeft).toBe(1_400);
    expect(status.level).toBe("soon");
    expect(status.reason).toBe("km");
  });

  it("depășită după kilometri", () => {
    const status = serviceStatus(config, [{ date: "2026-10-02", kilometers: 2_700 }], "2026-10-02");
    expect(status.kmLeft).toBe(-100);
    expect(status.level).toBe("overdue");
  });

  it("și după timp, chiar dacă nu s-au atins kilometrii", () => {
    const status = serviceStatus(config, [], "2027-03-15");
    expect(status.nextServiceDate).toBe("2027-03-10");
    expect(status.level).toBe("overdue");
    expect(status.reason).toBe("time");
  });

  it("o revizie trecută în jurnal pornește contorul de la zero", () => {
    const days: DayServiceInfo[] = [
      { date: "2026-10-05", kilometers: 100, odometerKm: 190_200, serviceCost: 650, serviceKind: "revizie", serviceNote: "ulei și filtre" },
    ];
    const status = serviceStatus(config, days, "2026-10-06");
    expect(status.lastServiceKm).toBe(190_200);
    expect(status.lastServiceDate).toBe("2026-10-05");
    expect(status.nextServiceKm).toBe(205_200);
    expect(status.nextServiceDate).toBe("2027-10-05");
    expect(status.level).toBe("ok");
  });

  it("o reparație nu resetează revizia", () => {
    const days: DayServiceInfo[] = [{ date: "2026-10-05", kilometers: 100, serviceCost: 300, serviceKind: "frane" }];
    expect(serviceStatus(config, days, "2026-10-06").nextServiceKm).toBe(190_000);
  });

  it("fără interval nu există alertă", () => {
    const status = serviceStatus({ ...config, intervalKm: null, intervalMonths: null }, [], "2026-10-01");
    expect(status.level).toBe("unknown");
    expect(status.estimatedKm).toBe(187_400);
  });
});

describe("jurnalul", () => {
  it("păstrează toate intervențiile, cele mai noi primele, cu kilometrajul estimat când lipsește", () => {
    const days: DayServiceInfo[] = [
      { date: "2026-10-02", kilometers: 100, serviceCost: 120, serviceKind: "anvelope" },
      { date: "2026-10-03", kilometers: 50 },
      { date: "2026-10-04", kilometers: 80, odometerKm: 187_700, serviceCost: 300, serviceKind: "frane", serviceNote: "plăcuțe față" },
      { date: "2026-10-05", kilometers: 60, serviceCost: 40 },
    ];
    const log = serviceLog(config, days);
    expect(log.map((entry) => entry.date)).toEqual(["2026-10-05", "2026-10-04", "2026-10-02"]);
    expect(log[1]).toMatchObject({ kind: "frane", note: "plăcuțe față", odometerKm: 187_700, odometerEstimated: false });
    expect(log[2]).toMatchObject({ kind: "anvelope", odometerKm: 187_500, odometerEstimated: true });
    expect(log[0]).toMatchObject({ kind: "altele", odometerKm: 187_760 });
  });
});
