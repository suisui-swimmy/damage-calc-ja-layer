import { describe, expect, it } from "vitest";
import { calculate, Generations, Move, Pokemon } from "@smogon/calc";
import { resolveShowdownDisplayNameJa as lookup, showdownUiLabels } from "../showdown";
import type { ShowdownEntityKind } from "../showdown";
import catalog from "../data/generated/showdown-catalog.gen.json";
import itemOptions from "../data/generated/item-options.gen.json";
import moveOptions from "../data/generated/move-options.gen.json";
import natureOptions from "../data/generated/nature-options.gen.json";
import { getDisplayNameJa, resolveEntity } from "./resolver";
import { calculateDamage } from "../calc/smogonAdapter";

const toID = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

// Independent expectations from the reviewed bilingual table, including its
// corrected Absolite Z spelling and the separately confirmed Garchompite Z.
const megaStones = [
  ["Absolite Z", "アブソルナイトZ"],
  ["Barbaracite", "ガメノデスナイト"],
  ["Baxcalibrite", "セグレイブナイト"],
  ["Chandelurite", "シャンデラナイト"],
  ["Chesnaughtite", "ブリガロナイト"],
  ["Chimechite", "チリーンナイト"],
  ["Clefablite", "ピクシナイト"],
  ["Crabominite", "ケケンカニナイト"],
  ["Darkranite", "ダークライナイト"],
  ["Delphoxite", "マフォクシナイト"],
  ["Dragalgite", "ドラミドナイト"],
  ["Dragoninite", "カイリュナイト"],
  ["Drampanite", "ジジーロナイト"],
  ["Eelektrossite", "シビルドナイト"],
  ["Emboarite", "エンブオナイト"],
  ["Excadrite", "ドリュウズナイト"],
  ["Falinksite", "タイレーツナイト"],
  ["Feraligite", "オーダイルナイト"],
  ["Floettite", "フラエッテナイト"],
  ["Froslassite", "ユキメノコナイト"],
  ["Garchompite Z", "ガブリアスナイトZ"],
  ["Glimmoranite", "キラフロルナイト"],
  ["Golisopite", "グソクムシャナイト"],
  ["Golurkite", "ゴルーグナイト"],
  ["Greninjite", "ゲッコウガナイト"],
  ["Hawluchanite", "ルチャブルナイト"],
  ["Heatranite", "ヒードラナイト"],
  ["Lucarionite Z", "ルカリオナイトZ"],
  ["Magearnite", "マギアナイト"],
  ["Malamarite", "カラマネナイト"],
  ["Meganiumite", "メガニウムナイト"],
  ["Meowsticite", "ニャオニクスナイト"],
  ["Pyroarite", "カエンジシナイト"],
  ["Raichunite X", "ライチュウナイトX"],
  ["Raichunite Y", "ライチュウナイトY"],
  ["Scolipite", "ペンドラナイト"],
  ["Scovillainite", "スコヴィラナイト"],
  ["Scraftinite", "ズルズキナイト"],
  ["Skarmorite", "エアームドナイト"],
  ["Staraptite", "ムクホークナイト"],
  ["Starminite", "スターミナイト"],
  ["Tatsugirinite", "シャリタツナイト"],
  ["Victreebelite", "ウツボットナイト"],
  ["Zeraorite", "ゼラオラナイト"],
  ["Zygardite", "ジガルデナイト"],
] as const;

const hiddenPowerTypes = [
  ["Bug", "むし"], ["Dark", "あく"], ["Dragon", "ドラゴン"],
  ["Electric", "でんき"], ["Fighting", "かくとう"], ["Fire", "ほのお"],
  ["Flying", "ひこう"], ["Ghost", "ゴースト"], ["Grass", "くさ"],
  ["Ground", "じめん"], ["Ice", "こおり"], ["Poison", "どく"],
  ["Psychic", "エスパー"], ["Rock", "いわ"], ["Steel", "はがね"],
  ["Water", "みず"],
] as const;

const natures = [
  ["Adamant", "いじっぱり"], ["Bashful", "てれや"], ["Bold", "ずぶとい"],
  ["Brave", "ゆうかん"], ["Calm", "おだやか"], ["Careful", "しんちょう"],
  ["Docile", "すなお"], ["Gentle", "おとなしい"], ["Hardy", "がんばりや"],
  ["Hasty", "せっかち"], ["Impish", "わんぱく"], ["Jolly", "ようき"],
  ["Lax", "のうてんき"], ["Lonely", "さみしがり"], ["Mild", "おっとり"],
  ["Modest", "ひかえめ"], ["Naive", "むじゃき"], ["Naughty", "やんちゃ"],
  ["Quiet", "れいせい"], ["Quirky", "きまぐれ"], ["Rash", "うっかりや"],
  ["Relaxed", "のんき"], ["Sassy", "なまいき"], ["Serious", "まじめ"],
  ["Timid", "おくびょう"],
] as const;

// These Let's Go partner moves exist in Showdown but not in the current calc
// Japanese dictionary. Keep their identities visible without guessing labels.
const untranslatedPartnerMoves = [
  "Baddy Bad", "Bouncy Bubble", "Buzzy Buzz", "Floaty Fall", "Freezy Frost",
  "Glitzy Glow", "Pika Papow", "Sappy Seed", "Sizzly Slide", "Sparkly Swirl",
  "Splishy Splash", "Veevee Volley", "Zippy Zap",
] as const;

describe("Showdown moves, items and natures", () => {
  it("covers exactly the 45 previously inferred Mega Stone labels", () => {
    const inferred = itemOptions.entries.filter((entry) =>
      entry.fallback?.reason === "mega-stone-label-from-pokemon-name");
    expect(megaStones).toHaveLength(45);
    expect(megaStones.map(([name]) => name).sort())
      .toEqual(inferred.map((entry) => entry.showdownName).sort());
  });

  it.each(megaStones)("returns the reviewed Japanese label for %s by name and ID", (name, label) => {
    for (const input of [name, toID(name)]) {
      expect(lookup("item", input)).toMatchObject({
        status: "localized", kind: "item", input, inputId: toID(name),
        showdownId: toID(name), showdownName: name, displayNameJa: label,
        usage: "display-only", provenance: "showdown-overlay",
      });
    }
  });

  it("covers every typed Hidden Power in the pinned Showdown catalog", () => {
    const entries: { kind: string; showdownName: string }[] = catalog.entries;
    expect(entries.filter((entry) => entry.kind === "move" && entry.showdownName.startsWith("Hidden Power "))
      .map((entry) => entry.showdownName).sort())
      .toEqual(hiddenPowerTypes.map(([type]) => `Hidden Power ${type}`).sort());
  });

  it.each(hiddenPowerTypes)("retains the Hidden Power %s identity with its Japanese qualifier", (type, label) => {
    const name = `Hidden Power ${type}`;
    for (const input of [name, toID(name)]) {
      expect(lookup("move", input)).toMatchObject({
        status: "localized", kind: "move", input, inputId: toID(name),
        showdownId: toID(name), showdownName: name,
        displayNameJa: "めざめるパワー", variantLabelJa: label, usage: "display-only",
        dictionaryRef: { kind: "move", id: "hiddenpower", canonicalName: "Hidden Power" },
      });
    }
  });

  it("does not interpret the bare Hidden Power catalog type as a UI qualifier", () => {
    for (const input of ["Hidden Power", "hiddenpower"]) {
      const result = lookup("move", input);
      expect(result).toMatchObject({ status: "localized", showdownId: "hiddenpower", displayNameJa: "めざめるパワー" });
      expect(result).not.toHaveProperty("variantLabelJa");
    }
  });

  it.each([
    ["move", "Paleo Wave"], ["move", "Polar Flare"], ["move", "Shadow Strike"],
    ["item", "Crucibellite"], ["item", "Vile Vial"],
  ] as const)("keeps the CAP %s %s identity without inventing a Japanese label", (kind, name) => {
    for (const input of [name, toID(name)]) {
      const result = lookup(kind, input);
      expect(result).toMatchObject({
        status: "out-of-scope", kind, input, inputId: toID(name),
        showdownId: toID(name), showdownName: name, category: "cap",
        reason: "outside-localization-scope", usage: "display-only",
      });
      expect(result).not.toHaveProperty("displayNameJa");
    }
  });

  it.each(untranslatedPartnerMoves)("retains the known but untranslated move %s", (name) => {
    for (const input of [name, toID(name)]) {
      const result = lookup("move", input);
      expect(result).toMatchObject({
        status: "unsupported", kind: "move", input, inputId: toID(name),
        showdownId: toID(name), showdownName: name,
        reason: "missing-japanese-mapping", usage: "display-only",
      });
      expect(result).not.toHaveProperty("displayNameJa");
      expect(result).not.toHaveProperty("variantLabelJa");
      expect(result).not.toHaveProperty("dictionaryRef");
      expect(resolveEntity("move", input).status).toBe("not-found");
    }
  });

  it("covers all 25 natures in the pinned Showdown catalog and existing dictionary", () => {
    const entries: { kind: string; showdownName: string }[] = catalog.entries;
    expect(natures).toHaveLength(25);
    const names = natures.map(([name]) => name).sort();
    expect(entries.filter((entry) => entry.kind === "nature").map((entry) => entry.showdownName).sort()).toEqual(names);
    expect(natureOptions.entries.map((entry) => entry.showdownName).sort()).toEqual(names);
  });

  it.each(natures)("reuses the existing Japanese nature label for %s", (name, label) => {
    for (const input of [name, toID(name)]) {
      expect(lookup("nature", input)).toMatchObject({
        status: "localized", kind: "nature", input, inputId: toID(name),
        showdownId: toID(name), showdownName: name, displayNameJa: label,
        provenance: "existing-dictionary", usage: "display-only",
        dictionaryRef: { kind: "nature", id: toID(name), canonicalName: name },
      });
    }
    expect(getDisplayNameJa("nature", name)).toBe(label);
  });

  it.each([
    ["move", "Thunderbolt", "10まんボルト"],
    ["item", "Choice Specs", "こだわりメガネ"],
  ] as const)("reuses a regular %s dictionary entry for %s", (kind, name, label) => {
    for (const input of [name, toID(name)]) {
      expect(lookup(kind, input)).toMatchObject({
        status: "localized", showdownId: toID(name), showdownName: name,
        displayNameJa: label, provenance: "existing-dictionary",
      });
    }
  });

  it("exports the no-move UI label without creating a Showdown move identity", () => {
    expect(showdownUiLabels.noMove).toBe("技なし");
    for (const input of ["(No Move)", "nomove", "技なし"]) {
      const result = lookup("move", input);
      expect(result.status).toBe("not-found");
      expect(result).not.toHaveProperty("showdownId");
      expect(result).not.toHaveProperty("displayNameJa");
    }
    expect(resolveEntity("move", "(No Move)")).toMatchObject({
      status: "exact", canonicalName: "(No Move)", calcId: "nomove",
    });
  });

  it.each([
    ["move", "Hidden Power Fairy"], ["move", "Hidden Power Normal"],
    ["move", "Hidden Power Stellar"], ["move", "Hidden Power Unknown"],
    ["move", "hiddenpowerfir"], ["move", "めざめるパワー"],
    ["move", "日本語Hidden Power Fire"], ["move", "Thunderbol"],
    ["item", "Abosolite Z"], ["item", "abosolitez"],
    ["item", "Dragoninit"], ["item", "カイリュナイト"], ["item", "Unknownite"],
    ["nature", "Mod"], ["nature", "ひかえめ"], ["nature", "Unknown"],
    ["move", "Dragoninite"], ["item", "Thunderbolt"], ["nature", "Dragoninite"],
    ["item", "Modest"], ["move", "Modest"],
  ] as const)("does not guess a %s identity for %s", (kind, input) => {
    const result = lookup(kind, input);
    expect(result.status).toBe("not-found");
    expect(result).not.toHaveProperty("showdownId");
    expect(result).not.toHaveProperty("displayNameJa");
  });

  it("preserves calc dictionary labels and typed Hidden Power canonical resolution", () => {
    expect(itemOptions.entries.find((entry) => entry.id === "dragoninite"))
      .toMatchObject({ label: "カイリューナイト", sourceStatus: "adapter-temporary" });
    expect(lookup("item", "Dragoninite")).toMatchObject({ displayNameJa: "カイリュナイト" });
    expect(getDisplayNameJa("item", "Dragoninite")).toBe("カイリューナイト");
    expect(resolveEntity("item", "カイリューナイト")).toMatchObject({
      canonicalName: "Dragoninite", calcId: "dragoninite", sourceStatus: "adapter-temporary",
    });
    for (const [type, label] of hiddenPowerTypes) {
      const name = `Hidden Power ${type}`;
      expect(moveOptions.entries.find((entry) => entry.id === toID(name)))
        .toMatchObject({ label: `めざめるパワー(${label})`, sourceStatus: "adapter-temporary" });
      expect(resolveEntity("move", name)).toMatchObject({ status: "exact", canonicalName: name, calcId: toID(name) });
      expect(getDisplayNameJa("move", name)).toBe(`めざめるパワー(${label})`);
    }
  });

  it("hands the same resolved move, item and nature to calc after external display lookup", () => {
    const inputs = [
      ["move", "Hidden Power Fire"], ["item", "Dragoninite"], ["nature", "Timid"],
    ] as const satisfies readonly (readonly [ShowdownEntityKind, string])[];
    for (const [kind, name] of inputs) {
      expect(lookup(kind, name).status).toBe("localized");
      expect(resolveEntity(kind, name)).toMatchObject({ status: "exact", canonicalName: name, calcId: toID(name) });
    }
    const attacker = {
      level: 50,
      item: resolveEntity("item", "Dragoninite").canonicalName!,
      nature: resolveEntity("nature", "Timid").canonicalName!,
    };
    const moveName = resolveEntity("move", "Hidden Power Fire").canonicalName!;
    const actual = calculateDamage({
      attacker: { canonicalName: "Dragonite", ...attacker },
      defender: { canonicalName: "Mew", level: 50 }, move: { canonicalName: moveName },
    });
    const gen = Generations.get(9);
    const expected = calculate(gen, new Pokemon(gen, "Dragonite", attacker),
      new Pokemon(gen, "Mew", { level: 50 }), new Move(gen, moveName));
    expect(actual.damageRange).toEqual(expected.range());
    expect(actual.move.canonicalName).toBe("Hidden Power Fire");
    expect(actual.attacker).toMatchObject({ canonicalName: "Dragonite", item: "Dragoninite", nature: "Timid" });
  });
});
