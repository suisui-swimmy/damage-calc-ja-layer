import { describe, expect, it } from "vitest";
import { normalizeJaSearchText, toCalcId } from "./normalizeJa";
import { resolveEntity } from "./resolver";

describe("normalizeJa", () => {
  it("normalizes width, kana, separators, and canonical IDs for search", () => {
    expect(normalizeJaSearchText("１０ まん・ボルト")).toBe("10マンボルト");
    expect(normalizeJaSearchText("ピカチュウ")).toBe("ピカチュウ");
    expect(toCalcId("Choice Specs")).toBe("choicespecs");
  });
});

describe("resolveEntity", () => {
  it.each([
    ["pokemon", "ピカチュウ", "Pikachu"],
    ["pokemon", "Pikachu", "Pikachu"],
    ["move", "10まんボルト", "Thunderbolt"],
    ["move", "10万ボルト", "Thunderbolt"],
    ["move", "きあいだま", "Focus Blast"],
    ["item", "こだわりメガネ", "Choice Specs"],
    ["ability", "せいでんき", "Static"],
    ["nature", "ひかえめ", "Modest"],
    ["type", "でんき", "Electric"],
  ] as const)("resolves %s input %s to %s", (kind, input, expected) => {
    const result = resolveEntity(kind, input);

    expect(result.status).toMatch(/^(exact|alias)$/);
    expect(result.canonicalName).toBe(expected);
    expect(result.calcId).toBeTruthy();
    expect(result.displayNameJa).toBeTruthy();
    expect(result.candidates?.[0]).toMatchObject({
      canonicalName: expected,
      calcId: result.calcId,
      displayNameJa: result.displayNameJa,
      sourceStatus: expect.any(String),
      matchedBy: expect.any(String),
      matchText: expect.any(String),
      reason: expect.any(String),
    });
  });

  it("keeps not-found explicit", () => {
    expect(resolveEntity("pokemon", "ぜったいにいないポケモン")).toMatchObject({
      status: "not-found",
    });
  });

  it("uses manual alias overlays without editing generated options", () => {
    expect(resolveEntity("move", "10万ボルト")).toMatchObject({
      status: "alias",
      canonicalName: "Thunderbolt",
      displayNameJa: "10まんボルト",
      candidates: [
        expect.objectContaining({
          matchedBy: "manualAlias",
          matchText: "10万ボルト",
          reason: "manual alias match",
        }),
      ],
    });
  });

  it("keeps English canonical direct input explainable", () => {
    expect(resolveEntity("move", "Thunderbolt")).toMatchObject({
      status: "exact",
      canonicalName: "Thunderbolt",
      candidates: [
        expect.objectContaining({
          matchedBy: "canonical",
          matchText: "Thunderbolt",
          reason: "canonical name exact match",
        }),
      ],
    });
  });

  it("keeps Japanese label exact input explainable", () => {
    expect(resolveEntity("pokemon", "ピカチュウ")).toMatchObject({
      status: "exact",
      canonicalName: "Pikachu",
      candidates: [
        expect.objectContaining({
          matchedBy: "label",
          matchText: "ピカチュウ",
          reason: "label exact match",
        }),
      ],
    });
  });

  it("returns searchText token candidates without choosing one", () => {
    const result = resolveEntity("move", "electric");

    expect(result.status).toBe("ambiguous");
    expect(result.candidates?.length).toBeGreaterThan(1);
    expect(result.candidates).toContainEqual(
      expect.objectContaining({
        canonicalName: "Thunderbolt",
        matchedBy: "searchText",
        matchText: "electric",
      }),
    );
  });

  it("returns a single fuzzy match when the substring is narrow enough", () => {
    expect(resolveEntity("item", "こだわりメ", { allowFuzzy: true })).toMatchObject({
      status: "fuzzy",
      canonicalName: "Choice Specs",
      candidates: [
        expect.objectContaining({
          matchedBy: "fuzzy",
          matchText: "こだわりメ",
          reason: "searchText fuzzy match",
        }),
      ],
    });
  });

  it("keeps exact duplicate labels ambiguous", () => {
    const result = resolveEntity("pokemon", "ギルガルド ブレードフォルム");

    expect(result.status).toBe("ambiguous");
    expect(result.candidates?.map((candidate) => candidate.canonicalName)).toEqual(
      expect.arrayContaining(["Aegislash-Blade", "Aegislash-Both"]),
    );
  });

  it("passes sourceStatus through to UI candidates", () => {
    expect(resolveEntity("move", "めざめるパワー(でんき)")).toMatchObject({
      status: "exact",
      canonicalName: "Hidden Power Electric",
      sourceStatus: "adapter-temporary",
      candidates: [
        expect.objectContaining({
          sourceStatus: "adapter-temporary",
        }),
      ],
    });
  });

  it("derives Arceus type-form labels from canonical type suffixes", () => {
    expect(resolveEntity("pokemon", "Arceus-Bug")).toMatchObject({
      status: "exact",
      canonicalName: "Arceus-Bug",
      displayNameJa: "アルセウス むしタイプ",
    });
    expect(resolveEntity("pokemon", "アルセウス むしタイプ")).toMatchObject({
      status: "exact",
      canonicalName: "Arceus-Bug",
      displayNameJa: "アルセウス むしタイプ",
    });
  });

  it("does not collapse fuzzy ambiguity into one candidate", () => {
    const result = resolveEntity("pokemon", "ピカ", { allowFuzzy: true });

    expect(result.status).toBe("ambiguous");
    expect(result.candidates?.length).toBeGreaterThan(1);
  });
});
