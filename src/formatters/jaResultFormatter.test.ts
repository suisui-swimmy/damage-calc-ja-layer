import { describe, expect, it } from "vitest";
import { calculateDamage } from "../calc/smogonAdapter";
import { formatDamageResultJa } from "./jaResultFormatter";

describe("formatDamageResultJa", () => {
  it("returns a minimal Japanese display structure", () => {
    const calcResult = calculateDamage({
      attacker: {
        canonicalName: "Pikachu",
        level: 50,
        nature: "Modest",
        item: "Choice Specs",
        evs: { spa: 252 },
      },
      defender: {
        canonicalName: "Squirtle",
        level: 50,
        evs: { hp: 252 },
      },
      move: {
        canonicalName: "Thunderbolt",
      },
    });

    const formatted = formatDamageResultJa(calcResult);

    expect(formatted.attackerNameJa).toBe("ピカチュウ");
    expect(formatted.moveNameJa).toBe("10まんボルト");
    expect(formatted.summaryText).toContain("ダメージ");
    expect(formatted.sourceDescription).toContain("Pikachu");
  });
});
