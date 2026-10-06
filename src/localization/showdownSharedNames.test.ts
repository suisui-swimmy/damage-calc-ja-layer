import { describe, expect, it } from "vitest";
import { resolveShowdownDisplayNameJa as lookup } from "../showdown";
import { getDisplayNameJa, resolveEntity } from "./resolver";
import { validateSharedDisplayNames } from "../../scripts/lib/showdown-shared-names.mjs";

// Independent expectations from the reviewed Japanese names, not the runtime mapping.
const cases = [
  ["pokemon", "Darmanitan-Galar-Zen", "ヒヒダルマ ガラルのすがた・ダルマモード", undefined],
  ["pokemon", "Darmanitan-Zen", "ヒヒダルマ ダルマモード", undefined],
  ["pokemon", "Toxtricity-Gmax", "ストリンダー ハイなすがた・キョダイマックスのすがた", undefined],
  ["pokemon", "Urshifu-Gmax", "ウーラオス いちげきのかた・キョダイマックスのすがた", undefined],
  ["pokemon", "Magearna-Original-Mega", "メガマギアナ ５００ねんまえのいろ", undefined],
  ["pokemon", "Meowstic-M-Mega", "メガニャオニクス", "オス"],
  ["pokemon", "Meowstic-F-Mega", "メガニャオニクス", "メス"],
  ["pokemon", "Tatsugiri-Curly-Mega", "メガシャリタツ そったすがた", undefined],
  ["pokemon", "Tatsugiri-Droopy-Mega", "メガシャリタツ たれたすがた", undefined],
  ["pokemon", "Tatsugiri-Stretchy-Mega", "メガシャリタツ のびたすがた", undefined],
  ["pokemon", "Eevee-Starter", "イーブイ（相棒）", undefined],
  ["pokemon", "Pikachu-Starter", "ピカチュウ（相棒）", undefined],
  ["pokemon", "Pichu-Spiky-eared", "ギザみみピチュー", undefined],
  ["pokemon", "Marowak-Alola-Totem", "ガラガラ アローラのすがた（ぬし）", undefined],
  ["pokemon", "Raticate-Alola-Totem", "ラッタ アローラのすがた（ぬし）", undefined],
  ["pokemon", "Mimikyu-Totem", "ミミッキュ ばけたすがた（ぬし）", undefined],
  ["pokemon", "Mimikyu-Busted-Totem", "ミミッキュ ばれたすがた（ぬし）", undefined],
  ["pokemon", "Greninja-Bond", "ゲッコウガ", "きずなへんげ"],
  ["pokemon", "Rockruff-Dusk", "イワンコ", "マイペース"],
  ["pokemon", "Ogerpon-Cornerstone-Tera", "オーガポン いしずえのめん", "テラスタル"],
  ["pokemon", "Ogerpon-Hearthflame-Tera", "オーガポン かまどのめん", "テラスタル"],
  ["pokemon", "Ogerpon-Teal-Tera", "オーガポン みどりのめん", "テラスタル"],
  ["pokemon", "Ogerpon-Wellspring-Tera", "オーガポン いどのめん", "テラスタル"],
  ["ability", "As One (Glastrier)", "じんばいったい", "ブリザポス"],
  ["ability", "As One (Spectrier)", "じんばいったい", "レイスポス"],
  ["ability", "Embody Aspect (Cornerstone)", "おもかげやどし", "いしずえのめん"],
  ["ability", "Embody Aspect (Hearthflame)", "おもかげやどし", "かまどのめん"],
  ["ability", "Embody Aspect (Teal)", "おもかげやどし", "みどりのめん"],
  ["ability", "Embody Aspect (Wellspring)", "おもかげやどし", "いどのめん"],
  ["ability", "Dragonize", "ドラゴンスキン", undefined],
  ["ability", "Mega Sol", "メガソーラー", undefined],
  ["ability", "Piercing Drill", "かんつうドリル", undefined],
  ["ability", "Spicy Spray", "とびだすハバネロ", undefined],
] as const;

describe("reviewed shared Japanese names", () => {
  it.each(cases)("resolves %s %s while retaining identity", (kind, name, label, qualifier) => {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const input of [name, id]) {
      const result = lookup(kind, input);
      expect(result).toMatchObject({ status: "localized", input, inputId: id, showdownId: id,
        showdownName: name, displayNameJa: label, usage: "display-only" });
      if (result.status !== "localized") throw new Error("Expected localized");
      expect(result.variantLabelJa).toBe(qualifier);
    }
  });

  it.each([
    ["Greninja", "Greninja-Bond"], ["Rockruff", "Rockruff-Dusk"],
    ["Ogerpon", "Ogerpon-Teal-Tera"], ["Ogerpon-Cornerstone", "Ogerpon-Cornerstone-Tera"],
    ["Ogerpon-Hearthflame", "Ogerpon-Hearthflame-Tera"], ["Ogerpon-Wellspring", "Ogerpon-Wellspring-Tera"],
    ["Meowstic-M-Mega", "Meowstic-F-Mega"],
  ])("allows one Japanese name for %s and %s without merging IDs", (first, second) => {
    const a = lookup("pokemon", first);
    const b = lookup("pokemon", second);
    if (a.status !== "localized" || b.status !== "localized") throw new Error("Expected localized pair");
    expect(a.displayNameJa).toBe(b.displayNameJa);
    expect(a.showdownId).not.toBe(b.showdownId);
    expect(a.variantLabelJa).not.toBe(b.variantLabelJa);
  });

  it("does not use Japanese labels or abilities to guess an external ID", () => {
    for (const name of ["ゲッコウガ", "ゲッコウガ（きずなへんげ）", "メガニャオニクス", "Ogerpon-Unknown-Tera"]) {
      expect(lookup("pokemon", name).status).toBe("not-found");
    }
    expect(lookup("ability", "じんばいったい").status).toBe("not-found");
    expect(lookup("pokemon", "Battle Bond").status).toBe("not-found");
    expect(lookup("pokemon", "Greninja-Ash")).toMatchObject({ showdownId: "greninjaash" });
    expect(resolveEntity("pokemon", "メガニャオニクス").status).toBe("ambiguous");
    expect(resolveEntity("ability", "じんばいったい").status).toBe("ambiguous");
    expect(resolveEntity("ability", "じんばいったい", { allowFuzzy: true }).status).toBe("ambiguous");
  });

  it("shares the reviewed translations with calc and returns fresh qualifier values", () => {
    expect(getDisplayNameJa("pokemon", "Urshifu-Gmax")).toBe("ウーラオス いちげきのかた・キョダイマックスのすがた");
    expect(getDisplayNameJa("pokemon", "Tatsugiri-Stretchy-Mega")).toBe("メガシャリタツ のびたすがた");
    expect(getDisplayNameJa("ability", "As One (Glastrier)")).toBe("じんばいったい (ブリザポス)");
    const result = lookup("pokemon", "Greninja-Bond");
    if (result.status !== "localized") throw new Error("Expected localized");
    result.variantLabelJa = "changed";
    expect(lookup("pokemon", "Greninja-Bond")).toMatchObject({ variantLabelJa: "きずなへんげ" });
  });
});

describe("shared-name generation guard", () => {
  const fixture = () => ({
    groups: [{ kind: "pokemon", displayNameJa: "ゲッコウガ", showdownIds: ["greninja", "greninjabond"],
      sources: ["https://www.pokemon.co.jp/"], verifiedOn: "2026-10-05" }],
    entries: [
      { kind: "pokemon", showdownId: "greninja", status: "localized", label: "ゲッコウガ", variantLabelJa: undefined as string | undefined },
      { kind: "pokemon", showdownId: "greninjabond", status: "localized", label: "ゲッコウガ", variantLabelJa: "きずなへんげ" },
    ],
  });
  const verify = (value: ReturnType<typeof fixture>) => validateSharedDisplayNames(value.groups, value.entries, (entry) => entry.label);
  it("accepts the exact reviewed members with distinct optional qualifiers", () => {
    expect([...verify(fixture())]).toEqual(["pokemon:ゲッコウガ"]);
  });
  it("rejects an unreviewed third identity with the same label", () => {
    const value = fixture();
    value.entries.push({ ...value.entries[1], showdownId: "greninjaash", variantLabelJa: "別形態" });
    expect(() => verify(value)).toThrow("membership changed");
  });
  it("rejects duplicate members, unknown members, wrong kinds, and duplicate groups", () => {
    for (const change of [
      (value: ReturnType<typeof fixture>) => { value.groups[0].showdownIds.push("greninja"); },
      (value: ReturnType<typeof fixture>) => { value.groups[0].showdownIds[1] = "unknown"; },
      (value: ReturnType<typeof fixture>) => { value.groups[0].kind = "ability"; },
      (value: ReturnType<typeof fixture>) => { value.groups.push({ ...value.groups[0] }); },
    ]) { const value = fixture(); change(value); expect(() => verify(value)).toThrow(); }
  });
  it("rejects labels, statuses, qualifiers or evidence that no longer match the review", () => {
    for (const change of [
      (value: ReturnType<typeof fixture>) => { value.entries[1].label = "サトシゲッコウガ"; },
      (value: ReturnType<typeof fixture>) => { value.entries[1].status = "needs-confirmation"; },
      (value: ReturnType<typeof fixture>) => { value.entries[1].variantLabelJa = undefined; },
      (value: ReturnType<typeof fixture>) => { value.entries[1].variantLabelJa = " "; },
      (value: ReturnType<typeof fixture>) => { value.groups[0].sources = []; },
      (value: ReturnType<typeof fixture>) => { value.groups[0].sources = [" "]; },
      (value: ReturnType<typeof fixture>) => { value.groups[0].verifiedOn = ""; },
    ]) { const value = fixture(); change(value); expect(() => verify(value)).toThrow(); }
  });
});
