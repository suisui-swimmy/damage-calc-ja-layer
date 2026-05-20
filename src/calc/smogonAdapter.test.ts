import { describe, expect, it } from "vitest";
import { calculateDamage, getSmogonCalcVersion } from "./smogonAdapter";

describe("smogonAdapter", () => {
  it("gets @smogon/calc package version", () => {
    expect(getSmogonCalcVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("calculates a minimal Pikachu / Thunderbolt smoke case", () => {
    const result = calculateDamage({
      attacker: {
        name: "Pikachu",
        level: 50,
        nature: "Modest",
        item: "Choice Specs",
        evs: { spa: 252 },
      },
      defender: {
        name: "Squirtle",
        level: 50,
        evs: { hp: 252 },
      },
      move: {
        name: "Thunderbolt",
      },
    });

    expect(result.damageRolls.length).toBeGreaterThan(0);
    expect(result.damageRange[0]).toBeGreaterThan(0);
    expect(result.attacker.canonicalName).toBe("Pikachu");
    expect(result.attacker.item).toBe("Choice Specs");
    expect(result.move.canonicalName).toBe("Thunderbolt");
    expect(result.description).toContain("Pikachu");
  });
});
