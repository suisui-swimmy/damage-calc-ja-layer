import { calculate, Generations, Move, Pokemon, toID } from "@smogon/calc";
import { describe, expect, it } from "vitest";
import pokemonOptions from "../data/generated/pokemon-options.gen.json";
import abilityOptions from "../data/generated/ability-options.gen.json";
import speciesCatalog from "../data/generated/calc-species.gen.json";
import abilityCatalog from "../data/generated/calc-abilities.gen.json";
import type { LocalizedOptionEntry } from "../data/optionTypes";
import { calculateDamage } from "../calc/smogonAdapter";
import { formatDamageResultJa } from "../formatters/jaResultFormatter";
import { applyManualLabelOverride, getOptionDisplayNameJa } from "./displayNameRules";
import { getDisplayNameJa, resolveEntity } from "./resolver";

const forms = [
  ["Tauros-Paldea-Aqua", "ケンタロス パルデアのすがた・ウォーターしゅ"],
  ["Tauros-Paldea-Blaze", "ケンタロス パルデアのすがた・ブレイズしゅ"],
  ["Tauros-Paldea-Combat", "ケンタロス パルデアのすがた・コンバットしゅ"],
  ["Vivillon", "ビビヨン"],
  ["Vivillon-Fancy", "ビビヨン ファンシーなもよう"],
  ["Vivillon-Pokeball", "ビビヨン ボールのもよう"],
] as const;

describe("calc form Japanese names", () => {
  it.each(forms)("displays and resolves %s consistently", (canonicalName, label) => {
    const option = pokemonOptions.entries.find((entry) => entry.showdownName === canonicalName)! as LocalizedOptionEntry;
    // The unfiltered UI reads raw options through this helper, not through resolver.
    expect(getOptionDisplayNameJa("pokemon", option)).toBe(label);
    expect(getDisplayNameJa("pokemon", canonicalName)).toBe(label);
    const { label: oldLabel, searchText: oldSearch, sourceStatus: oldStatus, ...originalData } = option;
    const { label: newLabel, searchText: newSearch, sourceStatus: newStatus, ...correctedData } =
      applyManualLabelOverride("pokemon", option);
    expect(correctedData).toEqual(originalData);
    expect(newStatus).toBe(oldStatus);
    expect(newLabel).toBe(label);
    expect(newSearch).toContain(canonicalName);
    expect(oldLabel).toBeTruthy();
    expect(oldSearch).toBeTruthy();
    for (const input of [label, canonicalName, option.id]) {
      expect(resolveEntity("pokemon", input)).toMatchObject({
        status: "exact", canonicalName, calcId: toID(canonicalName), displayNameJa: label,
      });
    }
  });

  it.each([
    ["ケンタロス ウォーター種", "Tauros-Paldea-Aqua"],
    ["ケンタロス ブレイズ種", "Tauros-Paldea-Blaze"],
    ["ケンタロス コンバット種", "Tauros-Paldea-Combat"],
    ["ぱるであけんたろす うぉーたーしゅ", "Tauros-Paldea-Aqua"],
  ])("resolves the distinguishing alias %s", (input, canonicalName) => {
    expect(resolveEntity("pokemon", input)).toMatchObject({ status: "alias", canonicalName });
  });

  it.each(["ケンタロス パルデアのすがた", "パルデアケンタロス", "ケンタロス パルデア"])(
    "does not choose a breed for %s", (input) => {
      const result = resolveEntity("pokemon", input, { allowFuzzy: true });
      expect(result.status).toBe("ambiguous");
      expect(result.canonicalName).toBeUndefined();
      expect(result.calcId).toBeUndefined();
      if (input !== "ケンタロス パルデア") {
        expect(resolveEntity("pokemon", input).status).toBe("ambiguous");
      }
      expect(result.candidates?.map((entry) => entry.canonicalName).sort()).toEqual(
        forms.slice(0, 3).map(([name]) => name).sort(),
      );
    },
  );

  it.each([
    ["ウォーターし", "Tauros-Paldea-Aqua"],
    ["ファンシーなも", "Vivillon-Fancy"],
    ["ボールのもよ", "Vivillon-Pokeball"],
  ])("searches corrected labels with %s", (input, canonicalName) => {
    expect(resolveEntity("pokemon", input, { allowFuzzy: true })).toMatchObject({
      status: "fuzzy", canonicalName,
    });
  });

  it.each(["はなぞののもよう", "ビビヨン はなぞののもよう", "はなぞの"])(
    "does not retain the incorrect pattern token %s", (input) => {
      expect(resolveEntity("pokemon", input, { allowFuzzy: true }).status).toBe("not-found");
    },
  );

  it("keeps only the three calc Vivillon entries and their shared calculation data", () => {
    const gen = Generations.get(9);
    const entries = [...gen.species].filter((entry) => entry.name.startsWith("Vivillon"));
    expect(entries.map((entry) => entry.name).sort()).toEqual(forms.slice(3).map(([name]) => name).sort());
    const base = gen.species.get(toID("Vivillon"))!;
    expect(base.otherFormes).toEqual(["Vivillon-Fancy", "Vivillon-Pokeball"]);
    for (const entry of entries) {
      expect(entry.baseStats).toEqual(base.baseStats);
      expect(entry.types).toEqual(base.types);
      expect(entry.weightkg).toBe(base.weightkg);
      expect(entry.abilities).toEqual(base.abilities);
    }
  });

  it.each([...forms.map(([name]) => name), "Aegislash-Shield", "Aegislash-Blade", "Aegislash-Both"])(
    "preserves %s IDs and the handoff to calc", (canonicalName) => {
      const gen = Generations.get(9);
      const resolved = resolveEntity("pokemon", canonicalName);
      const id = toID(canonicalName);
      expect(resolved).toMatchObject({ status: "exact", canonicalName, calcId: id });
      expect(speciesCatalog.entries.find((entry) => entry.id === id)?.showdownName).toBe(canonicalName);
      const input = {
        attacker: { canonicalName: resolved.canonicalName!, level: 50 },
        defender: { canonicalName: "Mew", level: 50 },
        move: { canonicalName: "Tackle" },
      };
      const actual = calculateDamage(input);
      const direct = calculate(gen, new Pokemon(gen, canonicalName, { level: 50 }),
        new Pokemon(gen, "Mew", { level: 50 }), new Move(gen, "Tackle"));
      expect(actual.damageRolls).toEqual([direct.damage].flat(Infinity));
      expect(actual.damageRange).toEqual(direct.range());
      expect(actual.attacker.canonicalName).toBe(canonicalName);
      expect(actual.attacker.stats).toEqual(direct.attacker.stats);
      expect(formatDamageResultJa(actual).attacker.name).toEqual({
        canonicalName, displayNameJa: getDisplayNameJa("pokemon", canonicalName),
      });
      const label = forms.find(([name]) => name === canonicalName)?.[1];
      if (label) {
        expect(calculateDamage({ ...input, attacker: {
          ...input.attacker, canonicalName: resolveEntity("pokemon", label).canonicalName!,
        } })).toEqual(actual);
      }
    },
  );

  it.each(["Eelevate", "Aura Guard", "Fire Mane"])("does not invent calc support for %s", (name) => {
    expect(Generations.get(9).abilities.get(toID(name))).toBeUndefined();
    expect(abilityCatalog.entries.some((entry) => entry.showdownName === name)).toBe(false);
    expect(abilityOptions.entries.some((entry) => entry.showdownName === name)).toBe(false);
    expect(resolveEntity("ability", name).status).toBe("not-found");
    expect(getDisplayNameJa("ability", name)).toBe(name);
    expect(() => calculateDamage({
      attacker: { canonicalName: "Pikachu", ability: name },
      defender: { canonicalName: "Mew" }, move: { canonicalName: "Tackle" },
    })).toThrow("canonical ability");
  });
});
