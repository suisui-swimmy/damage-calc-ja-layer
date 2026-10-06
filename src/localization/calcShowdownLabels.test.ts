import { calculate, Generations, Move, Pokemon, toID } from "@smogon/calc";
import { describe, expect, it } from "vitest";
import abilityOptions from "../data/generated/ability-options.gen.json";
import itemOptions from "../data/generated/item-options.gen.json";
import moveOptions from "../data/generated/move-options.gen.json";
import natureOptions from "../data/generated/nature-options.gen.json";
import pokemonOptions from "../data/generated/pokemon-options.gen.json";
import typeOptions from "../data/generated/type-options.gen.json";
import speciesCatalog from "../data/generated/calc-species.gen.json";
import moveCatalog from "../data/generated/calc-moves.gen.json";
import itemCatalog from "../data/generated/calc-items.gen.json";
import abilityCatalog from "../data/generated/calc-abilities.gen.json";
import natureCatalog from "../data/generated/calc-natures.gen.json";
import typeCatalog from "../data/generated/calc-types.gen.json";
import type { EntityKind, LocalizedOptionEntry } from "../data/optionTypes";
import { calculateDamage } from "../calc/smogonAdapter";
import { formatDamageResultJa } from "../formatters/jaResultFormatter";
import { resolveShowdownDisplayNameJa } from "../showdown";
import { getOptionDisplayNameJa } from "./displayNameRules";
import { getDisplayNameJa, resolveEntity } from "./resolver";

const kinds: EntityKind[] = ["pokemon", "move", "item", "ability", "nature", "type"];
const optionsByKind: Record<EntityKind, LocalizedOptionEntry[]> = {
  pokemon: pokemonOptions.entries as unknown as LocalizedOptionEntry[],
  move: moveOptions.entries as unknown as LocalizedOptionEntry[],
  item: itemOptions.entries as unknown as LocalizedOptionEntry[],
  ability: abilityOptions.entries as unknown as LocalizedOptionEntry[],
  nature: natureOptions.entries as unknown as LocalizedOptionEntry[],
  type: typeOptions.entries as unknown as LocalizedOptionEntry[],
};
type CatalogEntry = { id: string; showdownName: string };
const calcCatalogEntriesByKind: Record<EntityKind, CatalogEntry[]> = {
  pokemon: speciesCatalog.entries as CatalogEntry[],
  move: moveCatalog.entries as CatalogEntry[],
  item: itemCatalog.entries as CatalogEntry[],
  ability: abilityCatalog.entries as CatalogEntry[],
  nature: natureCatalog.entries as CatalogEntry[],
  type: typeCatalog.entries as CatalogEntry[],
};
const calcCatalogIdentitiesByKind = Object.fromEntries(kinds.map((kind) => [
  kind,
  new Set(calcCatalogEntriesByKind[kind].map((entry) => `${entry.id}:${entry.showdownName}`)),
])) as Record<EntityKind, Set<string>>;

const matchingShowdownEntry = (kind: EntityKind, option: LocalizedOptionEntry) => {
  if (!calcCatalogIdentitiesByKind[kind].has(`${option.id}:${option.showdownName}`)) return undefined;
  const result = resolveShowdownDisplayNameJa(kind, option.showdownName);
  if (result.status === "not-found" || result.status === "ambiguous") return undefined;
  const sameCatalogIdentity = result.showdownName === option.showdownName && (
    result.showdownId === option.id ||
    (result.dictionaryRef?.id === option.id && result.dictionaryRef.canonicalName === option.showdownName)
  );
  return sameCatalogIdentity ? result : undefined;
};

const localizedOptionLabel = (
  kind: EntityKind,
  option: LocalizedOptionEntry,
  result: Extract<ReturnType<typeof resolveShowdownDisplayNameJa>, { status: "localized" }>,
) => {
  // Showdown's bare Vivillon denotes Meadow; calc intentionally uses the generic species label.
  if (kind === "pokemon" && option.showdownName === "Vivillon") return "ビビヨン";
  return result.variantLabelJa
    ? `${result.displayNameJa}${kind === "move" ? "" : " "}(${result.variantLabelJa})`
    : result.displayNameJa;
};

const expectJapaneseResolutionKeepsIdentity = (
  kind: EntityKind,
  input: string,
  canonicalName: string,
  calcId: string,
) => {
  const result = resolveEntity(kind, input);
  if (result.status === "ambiguous") {
    expect(result.canonicalName).toBeUndefined();
    expect(result.calcId).toBeUndefined();
    expect(result.candidates?.some((candidate) =>
      candidate.canonicalName === canonicalName && candidate.calcId === calcId,
    )).toBe(true);
    return;
  }
  expect(result).toMatchObject({ status: "exact", canonicalName, calcId });
};

describe("calc Japanese labels follow matching Showdown display records", () => {
  it.each(kinds)("keeps %s generated options inside the calc catalog", (kind) => {
    const exceptions = kind === "ability"
      ? new Set(["Piercing Drill", "Spicy Spray", "Dragonize", "Mega Sol"])
      : kind === "type" ? new Set(["???"]) : new Set<string>();
    const optionsMissingFromCalc = optionsByKind[kind]
      .filter((option) => !calcCatalogIdentitiesByKind[kind].has(`${option.id}:${option.showdownName}`));
    expect(optionsMissingFromCalc.map((option) => option.showdownName).sort()).toEqual([...exceptions].sort());

    for (const option of optionsMissingFromCalc) {
      if (kind === "ability") {
        expect(option).toMatchObject({ calcAvailable: false, sourceStatus: "needs-confirmation" });
      } else {
        expect(option).toMatchObject({ id: "unknown", showdownName: "???", label: "???" });
      }
    }
  });

  it.each(kinds)("keeps %s labels and all input identities aligned", (kind) => {
    const matches = optionsByKind[kind]
      .map((option) => ({ option, external: matchingShowdownEntry(kind, option) }))
      .filter((entry): entry is typeof entry & { external: NonNullable<typeof entry.external> } => Boolean(entry.external));
    expect(matches.length).toBeGreaterThan(0);

    for (const { option, external } of matches) {
      const english = resolveEntity(kind, option.showdownName);
      const byId = resolveEntity(kind, option.id);
      expect(english).toMatchObject({ status: "exact", canonicalName: option.showdownName, calcId: option.id });
      expect(byId).toMatchObject({ status: "exact", canonicalName: option.showdownName, calcId: option.id });
      expect(option.id).toBe(toID(option.showdownName));

      if (external.status === "localized") {
        const expectedLabel = localizedOptionLabel(kind, option, external);
        expect(getOptionDisplayNameJa(kind, option)).toBe(expectedLabel);
        expect(english.displayNameJa).toBe(expectedLabel);
        expect(english.sourceStatus).toBe(option.calcAvailable === false ? "needs-confirmation" : "supported");
        expectJapaneseResolutionKeepsIdentity(kind, expectedLabel, option.showdownName, option.id);
      } else {
        expect(external.status).toBe("out-of-scope");
        if (external.status !== "out-of-scope") continue;
        expect(getOptionDisplayNameJa(kind, option)).toBe(option.showdownName);
        expect(english).toMatchObject({
          displayNameJa: option.showdownName,
          sourceStatus: "out-of-scope",
          localizationCategory: external.category,
          noteJa: external.noteJa,
        });
        expectJapaneseResolutionKeepsIdentity(kind, option.showdownName, option.showdownName, option.id);
      }
    }
  });

  it("keeps the eight CAP entries out of the supported Japanese scope", () => {
    const outOfScope: Array<{ kind: EntityKind; option: LocalizedOptionEntry }> = [];
    for (const kind of kinds) {
      for (const option of optionsByKind[kind]) {
        const external = matchingShowdownEntry(kind, option);
        if (external?.status === "out-of-scope") outOfScope.push({ kind, option });
      }
    }
    expect(outOfScope).toHaveLength(8);
    expect(outOfScope.map(({ kind }) => kind).sort()).toEqual([
      "ability", "ability", "ability", "item", "item", "move", "move", "move",
    ]);
    for (const { kind, option } of outOfScope) {
      const result = resolveEntity(kind, option.showdownName);
      expect(result.sourceStatus).toBe("out-of-scope");
      expect(result.localizationCategory).toBe("cap");
      expect(result.noteJa).toBeTruthy();
      expect(result.displayNameJa).toBe(option.showdownName);
    }
  });

  it("keeps old shared-form labels assigned to their actual calc identities", () => {
    const oldLabels = [
      ["シルヴァディ タイプ：ノーマル", "Silvally"],
      ["イッカネズミ ４ひきかぞく", "Maushold-Four"],
      ["メテノ りゅうせいのすがた", "Minior-Meteor"],
      ["チェリム ネガフォルム", "Cherrim"],
      ["ヒヒダルマ ダルマモード", "Darmanitan-Zen"],
      ["ウーラオス れんげきのかた・キョダイマックスのすがた", "Urshifu-Rapid-Strike-Gmax"],
    ] as const;
    for (const [label, canonicalName] of oldLabels) {
      expect(resolveEntity("pokemon", label)).toMatchObject({
        status: "exact", canonicalName, calcId: toID(canonicalName),
      });
    }

    expect(resolveEntity("pokemon", "シルヴァディ むしタイプ")).toMatchObject({
      status: "alias", canonicalName: "Silvally-Bug", calcId: "silvallybug", displayNameJa: "シルヴァディ タイプ：バグ",
    });
    expect(resolveEntity("item", "カラマネロナイト")).toMatchObject({
      status: "alias", canonicalName: "Malamarite", calcId: "malamarite", displayNameJa: "カラマネナイト",
    });

    expect(resolveEntity("pokemon", "シルヴァディ タイプ：バグ")).toMatchObject({
      status: "exact", canonicalName: "Silvally-Bug", calcId: "silvallybug",
    });
    expect(resolveEntity("pokemon", "タイプ：バグ")).toMatchObject({
      status: "alias", canonicalName: "Silvally-Bug", calcId: "silvallybug",
    });
    const ambiguous = resolveEntity("pokemon", "メガニャオニクス", { allowFuzzy: true });
    expect(ambiguous.status).toBe("ambiguous");
    expect(ambiguous.candidates?.map((candidate) => candidate.calcId).sort()).toEqual([
      "meowsticfmega", "meowsticmmega",
    ]);
  });

  it("does not promote Showdown-only labels or calc-only placeholders across catalogs", () => {
    expect(resolveShowdownDisplayNameJa("pokemon", "Vivillon-Archipelago").status).toBe("localized");
    expect(resolveEntity("pokemon", "Vivillon-Archipelago").status).toBe("not-found");
    expect(resolveShowdownDisplayNameJa("ability", "Eelevate").status).toBe("localized");
    expect(abilityOptions.entries.some((entry) => entry.showdownName === "Eelevate")).toBe(false);
    expect(resolveEntity("ability", "Eelevate").status).toBe("not-found");

    for (const [kind, canonicalName, expectedLabel] of [
      ["pokemon", "Aegislash-Both", "ギルガルド ブレードフォルム"],
      ["move", "(No Move)", "(No Move)"],
    ] as const) {
      expect(resolveShowdownDisplayNameJa(kind, canonicalName).status).toBe("not-found");
      expect(resolveEntity(kind, canonicalName)).toMatchObject({
        status: "exact", canonicalName, calcId: toID(canonicalName), displayNameJa: expectedLabel,
      });
      expect(getDisplayNameJa(kind, canonicalName)).toBe(expectedLabel);
    }

    expect(resolveEntity("pokemon", "Definitely Unknown Pokemon").status).toBe("not-found");
    expect(resolveShowdownDisplayNameJa("pokemon", "Definitely Unknown Pokemon").status).toBe("not-found");
  });

  it("keeps four Champions-only ability translations unavailable to calc", () => {
    const championsOnlyAbilities = ["Piercing Drill", "Spicy Spray", "Dragonize", "Mega Sol"];
    const calcAbilityNames = new Set(abilityCatalog.entries.map((entry) => entry.showdownName));
    for (const canonicalName of championsOnlyAbilities) {
      const option = abilityOptions.entries.find((entry) => entry.showdownName === canonicalName);
      expect(option).toMatchObject({ calcAvailable: false, sourceStatus: "needs-confirmation" });
      expect(resolveShowdownDisplayNameJa("ability", canonicalName).status).toBe("localized");
      expect(calcAbilityNames.has(canonicalName)).toBe(false);
      expect(resolveEntity("ability", canonicalName).sourceStatus).toBe("needs-confirmation");
      expect(() => calculateDamage({
        attacker: { canonicalName: "Pikachu", ability: canonicalName },
        defender: { canonicalName: "Mew" },
        move: { canonicalName: "Tackle" },
      })).toThrow("canonical ability");
    }
  });

  it("keeps the corrected Pokemon and Mega Stone labels display-only beside calc output", () => {
    const generation = Generations.get(9);
    const pokemonCases = [
      ["Silvally-Bug", "シルヴァディ タイプ：バグ"],
      ["Maushold", "イッカネズミ ３びきかぞく"],
      ["Maushold-Four", "イッカネズミ ４ひきかぞく"],
      ["Minior", "メテノ あかいろのコア"],
      ["Minior-Meteor", "メテノ りゅうせいのすがた"],
      ["Cherrim-Sunshine", "チェリム ポジフォルム"],
      ["Darmanitan-Galar-Zen", "ヒヒダルマ ガラルのすがた・ダルマモード"],
      ["Urshifu-Gmax", "ウーラオス いちげきのかた・キョダイマックスのすがた"],
    ] as const;

    for (const [canonicalName, expectedLabel] of pokemonCases) {
      expect(getDisplayNameJa("pokemon", canonicalName)).toBe(expectedLabel);
      const input = {
        attacker: { canonicalName, level: 50 },
        defender: { canonicalName: "Mew", level: 50 },
        move: { canonicalName: "Tackle" },
      };
      const actual = calculateDamage(input);
      const direct = calculate(generation,
        new Pokemon(generation, canonicalName, { level: 50 }),
        new Pokemon(generation, "Mew", { level: 50 }),
        new Move(generation, "Tackle"),
      );
      expect(actual.damageRolls).toEqual([direct.damage].flat(Infinity));
      expect(actual.damageRange).toEqual(direct.range());
      expect(formatDamageResultJa(actual).attacker.name).toEqual({ canonicalName, displayNameJa: expectedLabel });
    }

    const megaStones = [
      ["Victreebel", "Victreebelite", "ウツボットナイト"],
      ["Skarmory", "Skarmorite", "エアームドナイト"],
      ["Dragonite", "Dragoninite", "カイリュナイト"],
    ] as const;
    for (const [pokemon, item, itemLabel] of megaStones) {
      const input = {
        attacker: { canonicalName: pokemon, level: 50, item },
        defender: { canonicalName: "Mew", level: 50 },
        move: { canonicalName: "Tackle" },
      };
      const actual = calculateDamage(input);
      const direct = calculate(generation,
        new Pokemon(generation, pokemon, { level: 50, item }),
        new Pokemon(generation, "Mew", { level: 50 }),
        new Move(generation, "Tackle"),
      );
      expect(actual.damageRolls).toEqual([direct.damage].flat(Infinity));
      expect(actual.damageRange).toEqual(direct.range());
      expect(formatDamageResultJa(actual).attacker.item).toEqual({ canonicalName: item, displayNameJa: itemLabel });
    }
  });
});
