import { describe, expect, it } from "vitest";
import calcDescSource from "../../node_modules/@smogon/calc/src/desc.ts?raw";
import referenceData from "../data/overrides/smogon-ko-reference-ja.json";
import { translateSmogonKoSourceTextJa } from "./smogonKoReferenceTranslator";

const CALC_VERSION = "0.11.0";

describe("translateSmogonKoSourceTextJa", () => {
  it("pins the reference profile to the installed @smogon/calc source vocabulary", () => {
    const staticEffects = Array.from(
      calcDescSource.matchAll(/texts\.push\('([^']+)'\)/g),
      (match) => match[1],
    );
    const upstreamEffects = new Set([
      ...staticEffects,
      "Dry Skin damage",
      "Solar Power damage",
    ]);

    expect(referenceData).toMatchObject({
      schemaVersion: 1,
      status: "reference",
      source: {
        package: "@smogon/calc",
        version: CALC_VERSION,
      },
      templateProfile: "smogon-calc-0.11.0",
    });
    expect(Object.keys(referenceData.effects).sort()).toEqual(
      Array.from(upstreamEffects).sort(),
    );
  });

  it("returns an explicitly non-authoritative reference translation", () => {
    expect(
      translateSmogonKoSourceTextJa(
        "guaranteed 3HKO after burn damage",
        CALC_VERSION,
      ),
    ).toEqual({
      sourceTextEn: "guaranteed 3HKO after burn damage",
      referenceTextJa: "確定3発（やけどダメージ込み）",
      displayText: "確定3発（やけどダメージ込み）",
      status: "translated",
      isAuthoritative: false,
      calcVersion: CALC_VERSION,
      templateProfile: "smogon-calc-0.11.0",
    });
  });

  it.each([
    ["guaranteed OHKO", "確定1発"],
    ["guaranteed 3HKO", "確定3発"],
    ["possible OHKO", "1発KOの可能性（確率算出不可）"],
    ["possible 8HKO", "8発KOの可能性（確率算出不可）"],
    ["57.4% chance to OHKO", "乱数1発（57.4%）"],
    ["57.4% chance to 2HKO", "乱数2発（57.4%）"],
    [
      "approx. possible OHKO",
      "1発KOの可能性（確率算出不可・概算）",
    ],
    [
      "approx. possible 8HKO",
      "8発KOの可能性（確率算出不可・概算）",
    ],
    ["approx. 12.6% chance to OHKO", "乱数1発（12.6%・概算）"],
    ["approx. 12.6% chance to 2HKO", "乱数2発（12.6%・概算）"],
    ["not a KO", "KO不可"],
    ["approx. not a KO", "KO不可（概算）"],
    ["guaranteed KO in 3 turns", "3ターンで確定KO"],
    [
      "possible KO in 3 turns",
      "3ターンでKOの可能性（確率算出不可）",
    ],
    [
      "approx. possible KO in 3 turns",
      "3ターンでKOの可能性（確率算出不可・概算）",
    ],
    [
      "possible 2HKO after Leftovers recovery",
      "2発KOの可能性（確率算出不可・たべのこし回復込み）",
    ],
    [
      "possible KO in 3 turns after Leftovers recovery",
      "3ターンでKOの可能性（確率算出不可・たべのこし回復込み）",
    ],
    [
      "57.4% chance to KO in 3 turns",
      "3ターンでKO（57.4%）",
    ],
    [
      "approx. 57.4% chance to KO in 3 turns after Leftovers recovery",
      "3ターンでKO（57.4%・たべのこし回復込み・概算）",
    ],
  ])("translates the supported base template %s", (sourceTextEn, expected) => {
    expect(
      translateSmogonKoSourceTextJa(sourceTextEn, CALC_VERSION).referenceTextJa,
    ).toBe(expected);
  });

  it("translates every one of the 34 supported after effects", () => {
    const effects = Object.entries(referenceData.effects);
    expect(effects).toHaveLength(34);

    for (const [sourceEffect, referenceEffectJa] of effects) {
      const translated = translateSmogonKoSourceTextJa(
        `guaranteed 2HKO after ${sourceEffect}`,
        CALC_VERSION,
      );
      expect(translated.status, sourceEffect).toBe("translated");
      expect(translated.referenceTextJa, sourceEffect).toBe(
        `確定2発（${referenceEffectJa}込み）`,
      );
    }
  });

  it.each([
    [
      "guaranteed 2HKO after burn damage and Leftovers recovery",
      "確定2発（やけどダメージ・たべのこし回復込み）",
    ],
    [
      "57.4% chance to 2HKO after Stealth Rock, burn damage, and Leftovers recovery",
      "乱数2発（57.4%・ステルスロック・やけどダメージ・たべのこし回復込み）",
    ],
    [
      "approx. 12.6% chance to 3HKO after Stealth Rock, 1 layer of Spikes, burn damage, and Leftovers recovery",
      "乱数3発（12.6%・ステルスロック・まきびし1層・やけどダメージ・たべのこし回復込み・概算）",
    ],
  ])("preserves the source order of effect lists", (sourceTextEn, expected) => {
    expect(
      translateSmogonKoSourceTextJa(sourceTextEn, CALC_VERSION).referenceTextJa,
    ).toBe(expected);
  });

  it.each([
    [
      "81.3% chance to OHKO (guaranteed OHKO after burn damage)",
      "乱数1発（81.3%・やけどダメージ込みで確定1発）",
    ],
    [
      "approx. 81.3% chance to OHKO (guaranteed OHKO after burn damage)",
      "乱数1発（81.3%・概算／やけどダメージ込みで確定1発）",
    ],
    [
      "25% chance to OHKO (56.3% chance to OHKO after hail damage)",
      "乱数1発（25%・あられダメージ込みでは56.3%）",
    ],
    [
      "approx. 25% chance to OHKO (approx. 56.3% chance to OHKO after hail damage)",
      "乱数1発（25%・概算／あられダメージ込みでは56.3%・概算）",
    ],
    [
      "25% chance to OHKO after Stealth Rock (guaranteed OHKO after hail damage)",
      "乱数1発（ステルスロック込みで25%・さらにあられダメージ込みで確定1発）",
    ],
    [
      "approx. 25% chance to OHKO after Stealth Rock (guaranteed OHKO after hail damage)",
      "乱数1発（ステルスロック込みで25%・概算／さらにあられダメージ込みで確定1発）",
    ],
    [
      "25% chance to OHKO after Stealth Rock (56.3% chance to OHKO after hail damage)",
      "乱数1発（ステルスロック込みで25%・さらにあられダメージ込みでは56.3%）",
    ],
    [
      "approx. 25% chance to OHKO after Stealth Rock (approx. 56.3% chance to OHKO after hail damage)",
      "乱数1発（ステルスロック込みで25%・概算／さらにあられダメージ込みでは56.3%・概算）",
    ],
  ])("translates a supported primary and alternative pair", (sourceTextEn, expected) => {
    expect(
      translateSmogonKoSourceTextJa(sourceTextEn, CALC_VERSION).referenceTextJa,
    ).toBe(expected);
  });

  it("accepts a line break before the parenthesized alternative", () => {
    const translated = translateSmogonKoSourceTextJa(
      "25% chance to OHKO\n(56.3% chance to OHKO after hail damage)",
      CALC_VERSION,
    );

    expect(translated.status).toBe("translated");
    expect(translated.referenceTextJa).toBe(
      "乱数1発（25%・あられダメージ込みでは56.3%）",
    );
  });

  it.each(["", "   ", "\n\t"])("treats an empty source as untranslated", (sourceTextEn) => {
    expect(translateSmogonKoSourceTextJa(sourceTextEn, CALC_VERSION)).toEqual({
      sourceTextEn,
      displayText: sourceTextEn,
      status: "source-empty",
      isAuthoritative: false,
      calcVersion: CALC_VERSION,
      templateProfile: "smogon-calc-0.11.0",
    });
  });

  it("falls back to the complete source for an unsupported calc version", () => {
    const sourceTextEn = "guaranteed 2HKO after burn damage";
    expect(translateSmogonKoSourceTextJa(sourceTextEn, "0.12.0")).toEqual({
      sourceTextEn,
      displayText: sourceTextEn,
      status: "unsupported-calc-version",
      isAuthoritative: false,
      calcVersion: "0.12.0",
      templateProfile: "smogon-calc-0.11.0",
    });
  });

  it.each([
    "guaranteed 2HKO after mystery damage",
    "guaranteed 2HKO after burn damage and mystery damage",
    "25% chance to OHKO (guaranteed OHKO after mystery damage)",
    "guaranteed 2HKO after Burn damage",
  ])("falls back without a partial translation for an unknown effect", (sourceTextEn) => {
    const translated = translateSmogonKoSourceTextJa(sourceTextEn, CALC_VERSION);
    expect(translated).toMatchObject({
      sourceTextEn,
      displayText: sourceTextEn,
      status: "unknown-effect",
      isAuthoritative: false,
    });
    expect(translated.referenceTextJa).toBeUndefined();
  });

  it.each([
    " guaranteed OHKO",
    "guaranteed OHKO ",
    "guaranteed 1HKO",
    "guaranteed KO in 1 turns",
    "approx. guaranteed OHKO",
    "0% chance to OHKO",
    "100% chance to OHKO",
    "guaranteed 2HKO after burn damage, Leftovers recovery",
    "guaranteed 2HKO after burn damage, and Leftovers recovery",
    "25% chance to 2HKO (guaranteed 2HKO after burn damage)",
    "25% chance to OHKO (possible OHKO after burn damage)",
    "25% chance to OHKO (56.3% chance to OHKO after burn damage) trailing",
  ])("falls back for an unsupported or non-anchored template", (sourceTextEn) => {
    const translated = translateSmogonKoSourceTextJa(sourceTextEn, CALC_VERSION);
    expect(translated).toMatchObject({
      sourceTextEn,
      displayText: sourceTextEn,
      status: "unsupported-template",
      isAuthoritative: false,
    });
    expect(translated.referenceTextJa).toBeUndefined();
  });
});
