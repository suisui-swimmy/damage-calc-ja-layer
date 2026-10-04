import { describe, expect, it } from "vitest";
import { calculate, Generations, Move, Pokemon } from "@smogon/calc";
import { resolveShowdownDisplayNameJa as lookup, showdownDisplayMetadata } from "../showdown";
import type { ShowdownEntityKind } from "../showdown";
import catalog from "../data/generated/showdown-catalog.gen.json";
import mapping from "../data/generated/showdown-display.gen.json";
import { getDisplayNameJa, resolveEntity } from "./resolver";
import { calculateDamage } from "../calc/smogonAdapter";

const toID = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
// Independent expectations in the source's formeOrder, including its bare Meadow entry.
const patterns = [
  ["Vivillon-Icy Snow", "ひょうせつのもよう"],
  ["Vivillon-Polar", "せつげんのもよう"],
  ["Vivillon-Tundra", "ゆきぐにのもよう"],
  ["Vivillon-Continental", "たいりくのもよう"],
  ["Vivillon-Garden", "ていえんのもよう"],
  ["Vivillon-Elegant", "みやびなもよう"],
  ["Vivillon", "はなぞののもよう"],
  ["Vivillon-Modern", "モダンなもよう"],
  ["Vivillon-Marine", "マリンのもよう"],
  ["Vivillon-Archipelago", "ぐんとうのもよう"],
  ["Vivillon-High Plains", "こうやのもよう"],
  ["Vivillon-Sandstorm", "さじんのもよう"],
  ["Vivillon-River", "たいがのもよう"],
  ["Vivillon-Monsoon", "スコールのもよう"],
  ["Vivillon-Savanna", "サバンナのもよう"],
  ["Vivillon-Sun", "たいようのもよう"],
  ["Vivillon-Ocean", "オーシャンのもよう"],
  ["Vivillon-Jungle", "ジャングルのもよう"],
  ["Vivillon-Fancy", "ファンシーなもよう"],
  ["Vivillon-Pokeball", "ボールのもよう"],
] as const;

describe("Showdown display API", () => {
  it("pins Showdown and reconciles all three Vivillon form lists", () => {
    expect(showdownDisplayMetadata.showdownCommit).toBe("3661ce40bf9001d185ce078b8920e12304204609");
    const base = catalog.entries.find((entry) => entry.kind === "pokemon" && entry.showdownId === "vivillon")!;
    expect(base.baseForme).toBe("Meadow");
    expect(base.formeOrder).toEqual(patterns.map(([name]) => name));
    expect([base.showdownName, ...base.cosmeticFormes!, ...base.otherFormes!].sort())
      .toEqual(patterns.map(([name]) => name).sort());
    expect(base.cosmeticFormes).toHaveLength(17);
    expect(base.otherFormes).toHaveLength(2);
    expect(catalog.aliases.vivillonmeadow).toBe("Vivillon");
    // These aliases must not erase the cosmetic identity retained by dex-species.ts.
    for (const name of base.cosmeticFormes!) {
      expect(catalog.aliases[toID(name) as keyof typeof catalog.aliases]).toBe("Vivillon");
      expect(lookup("pokemon", name)).toMatchObject({ showdownId: toID(name), showdownName: name });
    }
    expect(new Set(patterns.map(([, label]) => label)).size).toBe(20);
  });

  it.each(patterns)("preserves the name, ID and Japanese pattern for %s", (name, pattern) => {
    for (const input of [name, toID(name)]) {
      expect(lookup("pokemon", input)).toMatchObject({
        status: "localized", input, inputId: toID(name), showdownId: toID(name),
        showdownName: name, displayNameJa: `ビビヨン ${pattern}`, usage: "display-only",
      });
    }
  });

  it.each([
    ["Aegislash", "aegislash", "ギルガルド シールドフォルム", "Aegislash-Shield"],
    ["Aegislash-Blade", "aegislashblade", "ギルガルド ブレードフォルム", "Aegislash-Blade"],
    ["Tauros-Paldea-Aqua", "taurospaldeaaqua", "ケンタロス パルデアのすがた・ウォーターしゅ", "Tauros-Paldea-Aqua"],
    ["Tauros-Paldea-Blaze", "taurospaldeablaze", "ケンタロス パルデアのすがた・ブレイズしゅ", "Tauros-Paldea-Blaze"],
    ["Tauros-Paldea-Combat", "taurospaldeacombat", "ケンタロス パルデアのすがた・コンバットしゅ", "Tauros-Paldea-Combat"],
  ])("reuses the dictionary without replacing the external ID for %s", (name, id, label, dictionaryName) => {
    for (const input of [name, id]) expect(lookup("pokemon", input)).toMatchObject({
      status: "localized", inputId: id, showdownId: id, showdownName: name, displayNameJa: label,
      dictionaryRef: { canonicalName: dictionaryName, id: toID(dictionaryName) },
    });
  });

  it.each([
    ["Eelevate", "うなぎのぼり"], ["Aura Guard", "はどうのぼうご"], ["Fire Mane", "ほのおのたてがみ"],
  ])("localizes %s without adding calc support", (name, label) => {
    for (const input of [name, toID(name)]) expect(lookup("ability", input)).toMatchObject({
      status: "localized", showdownId: toID(name), showdownName: name, displayNameJa: label,
    });
    expect(resolveEntity("ability", name).status).toBe("not-found");
    expect(getDisplayNameJa("ability", name)).toBe(name);
    expect(() => calculateDamage({
      attacker: { canonicalName: "Pikachu", ability: name },
      defender: { canonicalName: "Mew" }, move: { canonicalName: "Tackle" },
    })).toThrow("canonical ability");
  });

  it("supports only explicitly reviewed aliases and preserves their original IDs", () => {
    expect(lookup("pokemon", "Vivillon-Meadow")).toMatchObject({
      status: "localized", inputId: "vivillonmeadow", showdownId: "vivillon",
      displayNameJa: "ビビヨン はなぞののもよう", matchedBy: "alias",
    });
    expect(lookup("pokemon", "aegislashshield")).toMatchObject({
      status: "localized", inputId: "aegislashshield", showdownId: "aegislash", matchedBy: "alias",
    });
    expect(lookup("pokemon", "taurospaldeawater").status).toBe("not-found");
  });

  it.each(["Tauros-Paldea", "taurospaldea"])("does not guess a breed for %s", (input) => {
    const result = lookup("pokemon", input);
    expect(result.status).toBe("ambiguous");
    expect(result).not.toHaveProperty("showdownId");
    expect(result).not.toHaveProperty("displayNameJa");
    if (result.status === "ambiguous") expect(result.candidates.map((c) => c.showdownId).sort())
      .toEqual(["taurospaldeaaqua", "taurospaldeablaze", "taurospaldeacombat"]);
  });

  it.each(["Aegislash-Both", "aegislashboth", "Vivillon-Unknown", "vivillonicy", "Unknownmon", "", "???", "constructor", "日本語Pikachu", "ピカチュウ"])(
    "does not fall back to a base species for %s", (input) => {
      const result = lookup("pokemon", input);
      expect(result.status).toBe("not-found");
      expect(result).not.toHaveProperty("showdownId");
      expect(result).not.toHaveProperty("displayNameJa");
    },
  );

  it("separates unsupported known forms, uncertain labels and unknown inputs", () => {
    expect(lookup("pokemon", "Pichu-Spiky-eared")).toMatchObject({ status: "unsupported", showdownId: "pichuspikyeared" });
    expect(lookup("pokemon", "Marowak-Alola-Totem")).toMatchObject({ status: "needs-confirmation", showdownId: "marowakalolatotem" });
    for (const input of ["Pichu-Spiky-eared", "Marowak-Alola-Totem"]) expect(lookup("pokemon", input)).not.toHaveProperty("displayNameJa");
    expect(lookup("ability", "Pikachu").status).toBe("not-found");
    expect(lookup("pokemon", "Static").status).toBe("not-found");
    expect(lookup("type", "Electric")).toMatchObject({ status: "localized", showdownId: "electric", displayNameJa: "でんき" });
    expect(lookup("type", "Stellar")).toMatchObject({ status: "localized", showdownId: "stellar", displayNameJa: "ステラ" });
  });

  it("withholds indistinguishable imported form labels even without fallback flags", () => {
    for (const name of ["Darmanitan-Galar-Zen", "Darmanitan-Zen"]) {
      expect(lookup("pokemon", name)).toMatchObject({ status: "needs-confirmation", reason: "non-distinct-form-label" });
      expect(lookup("pokemon", name)).not.toHaveProperty("displayNameJa");
    }
    expect(lookup("pokemon", "Araquanid")).toMatchObject({ status: "localized", displayNameJa: "オニシズクモ" });
  });

  it("resolves every generated entry by both exact name and ID without identity drift", () => {
    for (const entry of mapping.entries) {
      for (const input of [entry.showdownName, entry.showdownId]) {
        const actual = lookup(entry.kind as ShowdownEntityKind, input);
        expect(actual, `${entry.kind}:${input}`).toMatchObject({ status: entry.status, showdownId: entry.showdownId, showdownName: entry.showdownName });
        if (actual.status === "localized") expect(actual.displayNameJa).toMatch(/[\u3040-\u30ff\u3400-\u9fff]/u);
        else expect(actual).not.toHaveProperty("displayNameJa");
      }
    }
  });

  it("keeps results independent of callers mutating returned objects", () => {
    const result = lookup("pokemon", "Aegislash");
    if (result.status !== "localized") throw new Error("Expected localized");
    result.displayNameJa = "changed";
    result.dictionaryRef!.canonicalName = "Aegislash-Both";
    expect(lookup("pokemon", "Aegislash")).toMatchObject({ displayNameJa: "ギルガルド シールドフォルム", dictionaryRef: { canonicalName: "Aegislash-Shield" } });
  });

  it("preserves the calc Vivillon and Aegislash contracts and calculation handoff", () => {
    expect(getDisplayNameJa("pokemon", "Vivillon")).toBe("ビビヨン");
    expect(resolveEntity("pokemon", "Vivillon-Icy Snow").status).toBe("not-found");
    for (const name of ["Aegislash-Shield", "Aegislash-Blade", "Aegislash-Both", "Vivillon", "Vivillon-Fancy", "Vivillon-Pokeball"]) {
      lookup("pokemon", name);
      const resolved = resolveEntity("pokemon", name);
      expect(resolved).toMatchObject({ status: "exact", canonicalName: name, calcId: toID(name) });
      const gen = Generations.get(9);
      const actual = calculateDamage({ attacker: { canonicalName: resolved.canonicalName!, level: 50 }, defender: { canonicalName: "Mew", level: 50 }, move: { canonicalName: "Tackle" } });
      const expected = calculate(gen, new Pokemon(gen, name, { level: 50 }), new Pokemon(gen, "Mew", { level: 50 }), new Move(gen, "Tackle"));
      expect(actual.damageRange).toEqual(expected.range());
      expect(actual.attacker.canonicalName).toBe(name);
    }
  });
});
