import { calculate, Field, Generations, Move, Pokemon } from "@smogon/calc";
import { describe, expect, it } from "vitest";
import { calculateDamage, getSmogonCalcVersion } from "./smogonAdapter";
import { formatDamageResultJa } from "../formatters/jaResultFormatter";
import { resolveEntity } from "../localization/resolver";

const generation = Generations.get(9);

const flattenDamage = (damage: unknown): number[] => {
  if (typeof damage === "number") {
    return [damage];
  }
  if (Array.isArray(damage)) {
    return damage.flat(Infinity).filter((value): value is number => typeof value === "number");
  }
  return [];
};

describe("smogonAdapter", () => {
  it("gets @smogon/calc package version", () => {
    expect(getSmogonCalcVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("calculates a minimal Pikachu / Thunderbolt smoke case", () => {
    const result = calculateDamage({
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

    expect(result.damageRolls.length).toBeGreaterThan(0);
    expect(result.damageRange[0]).toBeGreaterThan(0);
    expect(result.damagePercentageRange?.notation).toBe("%");
    expect(result.damagePercentageRange?.min).toBeGreaterThan(0);
    expect(result.koChance).toMatchObject({
      turns: expect.any(Number),
      sourceText: expect.any(String),
    });
    expect(result.attacker.canonicalName).toBe("Pikachu");
    expect(result.attacker.item).toBe("Choice Specs");
    expect(result.attacker.nature).toBe("Modest");
    expect(result.move.canonicalName).toBe("Thunderbolt");
    expect(result.rawDescription).toContain("Pikachu");
  });

  it("matches direct @smogon/calc damage and range for the same canonical inputs", () => {
    const input = {
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
    };

    const adapterResult = calculateDamage(input);
    const directResult = calculate(
      generation,
      new Pokemon(generation, "Pikachu", {
        level: 50,
        nature: "Modest",
        item: "Choice Specs",
        evs: { spa: 252 },
      }),
      new Pokemon(generation, "Squirtle", {
        level: 50,
        evs: { hp: 252 },
      }),
      new Move(generation, "Thunderbolt"),
      new Field({ gameType: "Singles" }),
    );

    expect(adapterResult.damageRolls).toEqual(flattenDamage(directResult.damage));
    expect(adapterResult.damageRange).toEqual(directResult.range());
  });

  it("passes item, nature, EVs, IVs, boosts, and teraType through to @smogon/calc", () => {
    const result = calculateDamage({
      attacker: {
        canonicalName: "Pikachu",
        level: 50,
        nature: "Modest",
        item: "Choice Specs",
        ability: "Static",
        evs: { hp: 4, spa: 252, spe: 252 },
        ivs: { atk: 0 },
        boosts: { spa: 1 },
        teraType: "Electric",
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

    expect(result.attacker).toMatchObject({
      canonicalName: "Pikachu",
      level: 50,
      item: "Choice Specs",
      ability: "Static",
      nature: "Modest",
      teraType: "Electric",
    });
    expect(result.attacker.stats.spa).toBeGreaterThan(0);
    expect(result.rawDescription).toContain("+1 252+ SpA Choice Specs");
  });

  it("passes field weather, terrain, and side conditions without doing local damage math", () => {
    const adapterResult = calculateDamage({
      attacker: {
        canonicalName: "Pikachu",
        level: 50,
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
      field: {
        weather: "Rain",
        terrain: "Electric",
        defenderSide: {
          isLightScreen: true,
        },
      },
    });

    const directResult = calculate(
      generation,
      new Pokemon(generation, "Pikachu", {
        level: 50,
        evs: { spa: 252 },
      }),
      new Pokemon(generation, "Squirtle", {
        level: 50,
        evs: { hp: 252 },
      }),
      new Move(generation, "Thunderbolt"),
      new Field({
        gameType: "Singles",
        weather: "Rain",
        terrain: "Electric",
        defenderSide: {
          isLightScreen: true,
        },
      }),
    );

    expect(adapterResult.damageRolls).toEqual(flattenDamage(directResult.damage));
    expect(adapterResult.damageRange).toEqual(directResult.range());
    expect(adapterResult.field).toMatchObject({
      gameType: "Singles",
      weather: "Rain",
      terrain: "Electric",
      defenderSide: {
        isLightScreen: true,
      },
    });
    expect(adapterResult.rawDescription).toContain("through Light Screen");
  });

  it("keeps resolver responsibility outside adapter and accepts only resolved canonical names", () => {
    const attacker = resolveEntity("pokemon", "ピカチュウ");
    const defender = resolveEntity("pokemon", "ゼニガメ");
    const move = resolveEntity("move", "10万ボルト");
    const item = resolveEntity("item", "こだわりメガネ");
    const nature = resolveEntity("nature", "ひかえめ");

    expect(attacker.status).toMatch(/^(exact|alias)$/);
    expect(defender.status).toMatch(/^(exact|alias)$/);
    expect(move.status).toMatch(/^(exact|alias)$/);
    expect(item.status).toMatch(/^(exact|alias)$/);
    expect(nature.status).toMatch(/^(exact|alias)$/);

    const result = calculateDamage({
      attacker: {
        canonicalName: attacker.canonicalName!,
        item: item.canonicalName,
        nature: nature.canonicalName,
        evs: { spa: 252 },
      },
      defender: {
        canonicalName: defender.canonicalName!,
        evs: { hp: 252 },
      },
      move: {
        canonicalName: move.canonicalName!,
      },
    });

    expect(result.attacker.canonicalName).toBe("Pikachu");
    expect(result.defender.canonicalName).toBe("Squirtle");
    expect(result.move.canonicalName).toBe("Thunderbolt");
    expect(formatDamageResultJa(result).summaryText).toContain("10まんボルト");
  });

  it("rejects unresolved or non-canonical Pokemon names before calculating", () => {
    expect(() =>
      calculateDamage({
        attacker: {
          canonicalName: "ピカチュウ",
        },
        defender: {
          canonicalName: "Squirtle",
        },
        move: {
          canonicalName: "Thunderbolt",
        },
      }),
    ).toThrow("Unknown attacker canonical pokemon: ピカチュウ");
  });
});
