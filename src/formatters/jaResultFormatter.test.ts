import { describe, expect, it } from "vitest";
import { calculateDamage } from "../calc/smogonAdapter";
import { formatDamageResultJa } from "./jaResultFormatter";

describe("formatDamageResultJa", () => {
  it("returns a Japanese display structure from adapter output", () => {
    const calcResult = calculateDamage({
      attacker: {
        canonicalName: "Pikachu",
        level: 50,
        ability: "Static",
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

    expect(calcResult.damageRange).toEqual([204, 242]);
    expect(formatted.attackerNameJa).toBe("ピカチュウ");
    expect(formatted.defenderNameJa).toBe("ゼニガメ");
    expect(formatted.moveNameJa).toBe("10まんボルト");
    expect(formatted.attacker.name).toEqual({
      canonicalName: "Pikachu",
      displayNameJa: "ピカチュウ",
    });
    expect(formatted.attacker.item).toEqual({
      canonicalName: "Choice Specs",
      displayNameJa: "こだわりメガネ",
    });
    expect(formatted.attacker.ability).toEqual({
      canonicalName: "Static",
      displayNameJa: "せいでんき",
    });
    expect(formatted.attacker.nature).toEqual({
      canonicalName: "Modest",
      displayNameJa: "ひかえめ",
    });
    expect(formatted.move.type).toEqual({
      canonicalName: "Electric",
      displayNameJa: "でんき",
    });
    expect(formatted.damage).toMatchObject({
      min: calcResult.damageRange[0],
      max: calcResult.damageRange[1],
      range: calcResult.damageRange,
      rolls: calcResult.damageRolls,
    });
    expect(formatted.damage.percentageRange?.text).toContain("-");
    expect(formatted.damage.percentageRange?.text).toContain("%");
    expect(formatted.koChance?.labelJa).toBeTruthy();
    expect(formatted.koChance?.referenceTranslation).toMatchObject({
      status: "translated",
      displayText: expect.any(String),
      sourceTextEn: calcResult.koChance?.sourceText,
      isAuthoritative: false,
      calcVersion: "0.11.0",
      templateProfile: "smogon-calc-0.11.0",
    });
    expect(formatted.details).toContainEqual(
      expect.objectContaining({
        label: "攻撃側の持ち物",
        value: "こだわりメガネ",
        canonicalValue: "Choice Specs",
      }),
    );
    expect(formatted.summaryText).toContain("204-242 ダメージ");
    expect(formatted.summaryText).toContain("ダメージ");
    expect(formatted.sourceDescription).toContain("Pikachu");
    expect(formatted.rawDescription).toBe(calcResult.rawDescription);
  });

  it("formats weather, terrain, and side conditions already present in adapter output", () => {
    const calcResult = calculateDamage({
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

    const formatted = formatDamageResultJa(calcResult);

    expect(formatted.field.weather).toEqual({
      canonicalName: "Rain",
      labelJa: "あめ",
    });
    expect(formatted.field.terrain).toEqual({
      canonicalName: "Electric",
      labelJa: "エレキフィールド",
    });
    expect(formatted.field.defenderSideConditions).toContain("ひかりのかべ");
    expect(formatted.details).toContainEqual(
      expect.objectContaining({
        label: "防御側の場",
        value: "ひかりのかべ",
      }),
    );
  });

  it("falls back to canonical names when no Japanese display name is found", () => {
    const calcResult = calculateDamage({
      attacker: {
        canonicalName: "Pikachu",
      },
      defender: {
        canonicalName: "Squirtle",
      },
      move: {
        canonicalName: "Thunderbolt",
      },
    });

    const formatted = formatDamageResultJa({
      ...calcResult,
      attacker: {
        ...calcResult.attacker,
        canonicalName: "Missingmon",
      },
      move: {
        ...calcResult.move,
        canonicalName: "Mystery Beam",
      },
    });

    expect(formatted.attacker.name).toEqual({
      canonicalName: "Missingmon",
      displayNameJa: "Missingmon",
    });
    expect(formatted.move.name).toEqual({
      canonicalName: "Mystery Beam",
      displayNameJa: "Mystery Beam",
    });
    expect(formatted.summaryText).toContain("Missingmon の Mystery Beam");
  });

  it("keeps the Smogon source reference translation separate from structured KO values", () => {
    const calcResult = calculateDamage({
      attacker: {
        canonicalName: "Pikachu",
      },
      defender: {
        canonicalName: "Squirtle",
      },
      move: {
        canonicalName: "Thunderbolt",
      },
    });
    const sourceText = "guaranteed 2HKO after burn damage";

    const formatted = formatDamageResultJa({
      ...calcResult,
      koChance: {
        chance: 1,
        turns: 2,
        sourceText,
      },
    });

    expect(formatted.koChance).toMatchObject({
      chance: 1,
      turns: 2,
      labelJa: "確定2発",
      sourceText,
      referenceTranslation: {
        status: "translated",
        displayText: "確定2発（やけどダメージ込み）",
        referenceTextJa: "確定2発（やけどダメージ込み）",
        sourceTextEn: sourceText,
        isAuthoritative: false,
      },
    });
  });

  it("translates an after effect emitted by the live @smogon/calc path", () => {
    const calcResult = calculateDamage({
      attacker: {
        canonicalName: "Mew",
      },
      defender: {
        canonicalName: "Mew",
      },
      move: {
        canonicalName: "Tackle",
      },
      field: {
        weather: "Sand",
      },
    });
    const formatted = formatDamageResultJa(calcResult);

    expect(calcResult.koChance?.sourceText).toBe(
      "guaranteed 7HKO after sandstorm damage",
    );
    expect(formatted.koChance?.referenceTranslation).toMatchObject({
      status: "translated",
      displayText: "確定7発（すなあらしダメージ込み）",
      sourceTextEn: "guaranteed 7HKO after sandstorm damage",
      isAuthoritative: false,
    });
  });

  it("does not parse rawDescription to build Japanese display logic", () => {
    const calcResult = calculateDamage({
      attacker: {
        canonicalName: "Pikachu",
      },
      defender: {
        canonicalName: "Squirtle",
      },
      move: {
        canonicalName: "Thunderbolt",
      },
    });

    const formatted = formatDamageResultJa({
      ...calcResult,
      rawDescription:
        "Bulbasaur Razor Leaf vs. Charmander: 1-2 (1 - 2%) -- guaranteed OHKO",
    });

    expect(formatted.attackerNameJa).toBe("ピカチュウ");
    expect(formatted.defenderNameJa).toBe("ゼニガメ");
    expect(formatted.moveNameJa).toBe("10まんボルト");
    expect(formatted.summaryText).toContain("ピカチュウ の 10まんボルト");
    expect(formatted.summaryText).not.toContain("Bulbasaur");
    expect(formatted.sourceDescription).toContain("Bulbasaur");
  });
});
