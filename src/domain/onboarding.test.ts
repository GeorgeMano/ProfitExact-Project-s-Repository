import { describe, expect, it } from "vitest";
import {
  cityKey,
  formatCityName,
  normalizeCityInput,
} from "./onboarding";

describe("normalizarea orașului", () => {
  it("elimină diacriticele imediat", () => {
    expect(normalizeCityInput("Pitești")).toBe("Pitesti");
  });

  it("grupează scrieri echivalente sub aceeași cheie", () => {
    expect(cityKey("Pitești")).toBe("pitesti");
    expect(cityKey(" PITESTI ")).toBe("pitesti");
  });

  it("păstrează orașele compuse într-o formă afișabilă", () => {
    expect(formatCityName("cluj-napoca")).toBe("Cluj-Napoca");
    expect(formatCityName("targu   mures")).toBe("Targu Mures");
  });
});
