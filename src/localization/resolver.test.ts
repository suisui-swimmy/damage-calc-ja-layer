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
    });
  });

  it("does not collapse fuzzy ambiguity into one candidate", () => {
    const result = resolveEntity("pokemon", "ピカ", { allowFuzzy: true });

    expect(result.status).toBe("ambiguous");
    expect(result.candidates?.length).toBeGreaterThan(1);
  });
});
