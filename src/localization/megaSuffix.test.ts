import { expect, it } from "vitest";
import { getDisplayNameJa, resolveEntity } from "./resolver";
import { resolveShowdownDisplayNameJa } from "../showdown";

const pairs = [
  ["Charizard-Mega-X", "メガリザードンＸ", "Charizardite X", "リザードナイトＸ"],
  ["Charizard-Mega-Y", "メガリザードンＹ", "Charizardite Y", "リザードナイトＹ"],
  ["Mewtwo-Mega-X", "メガミュウツーＸ", "Mewtwonite X", "ミュウツナイトＸ"],
  ["Mewtwo-Mega-Y", "メガミュウツーＹ", "Mewtwonite Y", "ミュウツナイトＹ"],
  ["Raichu-Mega-X", "メガライチュウＸ", "Raichunite X", "ライチュウナイトＸ"],
  ["Raichu-Mega-Y", "メガライチュウＹ", "Raichunite Y", "ライチュウナイトＹ"],
  ["Absol-Mega-Z", "メガアブソルＺ", "Absolite Z", "アブソルナイトＺ"],
  ["Garchomp-Mega-Z", "メガガブリアスＺ", "Garchompite Z", "ガブリアスナイトＺ"],
  ["Lucario-Mega-Z", "メガルカリオＺ", "Lucarionite Z", "ルカリオナイトＺ"],
] as const;

it.each(pairs)("uses fullwidth Japanese suffixes for %s and its stone", (species, speciesJa, stone, stoneJa) => {
  for (const [kind, name, label] of [["pokemon", species, speciesJa], ["item", stone, stoneJa]] as const) {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    expect(getDisplayNameJa(kind, name)).toBe(label);
    for (const input of [name, id]) {
      expect(resolveShowdownDisplayNameJa(kind, input)).toMatchObject({
        status: "localized", showdownId: id, showdownName: name, displayNameJa: label,
      });
    }
    const halfwidth = label.replace(/[ＸＹＺ]$/, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    for (const input of [label, halfwidth, name, id]) {
      expect(resolveEntity(kind, input)).toMatchObject({canonicalName: name, calcId: id, displayNameJa: label});
    }
  }
});

it("leaves unrelated Latin suffixes intact and confirms the reviewed stone translation", () => {
  expect(getDisplayNameJa("pokemon", "Porygon-Z")).toBe("ポリゴンＺ");
  expect(resolveShowdownDisplayNameJa("pokemon", "Porygon-Z")).toMatchObject({showdownName: "Porygon-Z"});
  expect(resolveEntity("item", "Raichunite X")).toMatchObject({sourceStatus: "supported"});
});
