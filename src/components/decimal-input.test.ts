import { describe, expect, it } from "vitest";
import { formatDecimal, parseDecimal } from "./decimal-input";

describe("numerele scrise în română", () => {
  it("acceptă virgula și punctul la zecimale", () => {
    expect(parseDecimal("123,45")).toBe(123.45);
    expect(parseDecimal("123.45")).toBe(123.45);
    expect(parseDecimal("7,49")).toBe(7.49);
  });

  it("înțelege separatorul de mii", () => {
    expect(parseDecimal("1.225,78")).toBe(1225.78);
    expect(parseDecimal("1.225.000")).toBe(1225000);
    expect(parseDecimal("1 225,78")).toBe(1225.78);
  });

  it("acceptă un număr pe jumătate scris", () => {
    expect(parseDecimal("12,")).toBe(12);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal(",")).toBeNull();
  });

  it("afișează cu virgulă", () => {
    expect(formatDecimal(803.9)).toBe("803,9");
    expect(formatDecimal(16)).toBe("16");
  });
});
