import { describe, expect, it } from "vitest";
import { calculate, Generations, Move, Pokemon } from "@smogon/calc";
import names from "../data/overrides/showdown-pokemon-names.json";
import { resolveShowdownDisplayNameJa as lookup, showdownDisplayMetadata } from "../showdown";
import { getDisplayNameJa, resolveEntity } from "./resolver";
import { calculateDamage } from "../calc/smogonAdapter";

describe("approved Pokemon name imports", () => {
  it.each(names.entries)("returns the approved name and preserves $showdownId", (entry) => {
    for (const input of [entry.showdownName, entry.showdownId]) {
      expect(lookup("pokemon", input)).toMatchObject({ status: "localized", showdownId: entry.showdownId,
        showdownName: entry.showdownName, displayNameJa: entry.displayNameJa, provenance: "showdown-overlay", usage: "display-only" });
    }
  });

  it.each([
    ["Pikachu-Belle", "マダム・ピカチュウ"], ["Pikachu-Cosplay", "おきがえピカチュウ"],
    ["Pikachu-Libre", "マスクド・ピカチュウ"], ["Pikachu-PhD", "ドクター・ピカチュウ"],
    ["Pikachu-Pop-Star", "アイドル・ピカチュウ"], ["Pikachu-Rock-Star", "ハードロック・ピカチュウ"],
    ["Silvally-Bug", "シルヴァディ タイプ：バグ"], ["Silvally-Water", "シルヴァディ タイプ：ウオーター"],
    ["Maushold", "イッカネズミ ３びきかぞく"], ["Maushold-Four", "イッカネズミ ４ひきかぞく"],
    ["Minior", "メテノ あかいろのコア"], ["Mimikyu-Busted", "ミミッキュ ばれたすがた"],
    ["Cherrim-Sunshine", "チェリム ポジフォルム"], ["Poltchageist-Artisan", "チャデス タカイモノのすがた"],
    ["Sinistcha-Masterpiece", "ヤバソチャ ケッサクのすがた"], ["Sinistea-Antique", "ヤバチャ しんさくフォルム"],
  ])("keeps the reviewed spelling for %s", (name, label) => {
    expect(lookup("pokemon", name)).toMatchObject({ status: "localized", displayNameJa: label });
  });

  it("retains same-name source rows without collapsing external forms", () => {
    expect(names.entries).toHaveLength(182);
    expect(names.entries.reduce((count, entry) => count + entry.sourceRows.length, 0)).toBe(189);
    expect(names.entries.find((entry) => entry.showdownId === "miniormeteor")?.sourceRows).toHaveLength(7);
    expect(names.entries.find((entry) => entry.showdownId === "zygarde")?.sourceRows).toHaveLength(2);
    expect(lookup("pokemon", "Minior-Meteor")).toMatchObject({ showdownId: "miniormeteor", displayNameJa: "メテノ りゅうせいのすがた" });
    expect(lookup("pokemon", "Zygarde")).toMatchObject({ showdownId: "zygarde", displayNameJa: "ジガルデ ５０％フォルム" });
    expect(lookup("pokemon", "Minior-Blue")).toMatchObject({ showdownId: "miniorblue", displayNameJa: "メテノ みずいろのコア" });
  });

  it.each([["Frillish", "プルリル"], ["Jellicent", "ブルンゲル"], ["Pyroar", "カエンジシ"]])(
    "uses the approved species-only label for %s", (name, label) => {
      expect(lookup("pokemon", name)).toMatchObject({ status: "localized", displayNameJa: label });
    },
  );

  it("keeps the unapproved 32 decisions and translation scope separate", () => {
    expect(showdownDisplayMetadata.summary).toEqual({
      pokemon: { localized: 1447, "needs-confirmation": 19, unsupported: 3, "out-of-scope": 117 },
      ability: { localized: 308, "needs-confirmation": 10, unsupported: 0, "out-of-scope": 3 },
      type: { localized: 19, "needs-confirmation": 0, unsupported: 0, "out-of-scope": 0 },
    });
    for (const name of ["Darmanitan-Zen", "Darmanitan-Galar-Zen", "Urshifu-Gmax", "Ogerpon-Teal-Tera", "Meowstic-F-Mega"]) {
      expect(lookup("pokemon", name).status).toBe("needs-confirmation");
    }
    for (const name of ["Eevee-Starter", "Pikachu-Starter", "Pichu-Spiky-eared"]) expect(lookup("pokemon", name).status).toBe("unsupported");
    expect(lookup("ability", "Mega Sol").status).toBe("needs-confirmation");
    expect(lookup("pokemon", "Ababo").status).toBe("out-of-scope");
    expect(lookup("pokemon", "Pikachu-Unknown").status).toBe("not-found");
  });

  it("does not alter existing calc display labels or make imported cosmetic forms calculable", () => {
    expect(getDisplayNameJa("pokemon", "Silvally-Bug")).toBe("シルヴァディ むしタイプ");
    expect(getDisplayNameJa("pokemon", "Maushold")).toBe("イッカネズミ ４ひきかぞく");
    expect(getDisplayNameJa("pokemon", "Minior")).toBe("メテノ りゅうせいのすがた");
    expect(resolveEntity("pokemon", "Pikachu-Rock-Star").status).toBe("not-found");
    expect(() => calculateDamage({ attacker: { canonicalName: "Pikachu-Rock-Star" },
      defender: { canonicalName: "Mew" }, move: { canonicalName: "Tackle" } })).toThrow();
    const gen = Generations.get(9);
    for (const name of ["Silvally-Bug", "Maushold", "Minior", "Mimikyu-Busted"]) {
      const resolved = resolveEntity("pokemon", name);
      expect(resolved.canonicalName).toBe(name);
      const result = calculateDamage({ attacker: { canonicalName: resolved.canonicalName!, level: 50 },
        defender: { canonicalName: "Mew", level: 50 }, move: { canonicalName: "Tackle" } });
      const direct = calculate(gen, new Pokemon(gen, name, { level: 50 }), new Pokemon(gen, "Mew", { level: 50 }), new Move(gen, "Tackle"));
      expect(result.damageRange).toEqual(direct.range());
      expect(result.attacker.canonicalName).toBe(name);
    }
  });
});
