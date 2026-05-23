import { describe, expect, it } from "vitest";
import {
  defaultCalcScenario,
  parseCalcScenarioJson,
  serializeCalcScenario,
} from "./shareState";

describe("calc scenario share state", () => {
  it("round-trips calculation conditions as schema-versioned JSON", () => {
    const json = serializeCalcScenario(defaultCalcScenario);
    const parsed = parseCalcScenarioJson(json);

    expect(parsed.ok).toBe(true);
    expect(parsed.scenario).toEqual(defaultCalcScenario);
  });

  it("rejects unsupported schema versions", () => {
    const parsed = parseCalcScenarioJson(
      JSON.stringify({
        ...defaultCalcScenario,
        schemaVersion: 999,
      }),
    );

    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain("schemaVersion");
  });

  it("normalizes unsupported weather and terrain values to empty fields", () => {
    const parsed = parseCalcScenarioJson(
      JSON.stringify({
        ...defaultCalcScenario,
        field: {
          weather: "Typhoon",
          terrain: "Moon",
          defenderLightScreen: true,
        },
      }),
    );

    expect(parsed.ok).toBe(true);
    expect(parsed.scenario?.field).toEqual({
      weather: "",
      terrain: "",
      defenderLightScreen: true,
    });
  });
});
