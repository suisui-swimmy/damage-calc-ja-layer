import { describe, expect, it } from "vitest";
import { calculate, Generations, Move, Pokemon } from "@smogon/calc";
import options from "../data/generated/pokemon-options.gen.json";
import labelOverrides from "../data/overrides/ja-label-overrides.json";
import type { LocalizedOptionEntry } from "../data/optionTypes";
import { applyManualLabelOverride, getOptionDisplayNameJa } from "./displayNameRules";
import { getDisplayNameJa, resolveEntity } from "./resolver";
import { resolveShowdownDisplayNameJa } from "../showdown";
import { calculateDamage } from "../calc/smogonAdapter";
import { formatDamageResultJa } from "../formatters/jaResultFormatter";

const mega = options.entries.filter((entry) => /-Mega(?:-|$)/.test(entry.showdownName));
const overrides = labelOverrides.entries.filter((entry) => entry.kind === "pokemon" && entry.confirmsShowdownName === false);
const externalFormNames: Record<string, string> = {
  "Magearna-Original-Mega": "メガマギアナ ５００ねんまえのいろ",
  "Tatsugiri-Curly-Mega": "メガシャリタツ そったすがた",
  "Tatsugiri-Droopy-Mega": "メガシャリタツ たれたすがた",
  "Tatsugiri-Stretchy-Mega": "メガシャリタツ のびたすがた",
};

describe("non-repeating Mega display names", () => {
  it("covers every existing Mega entry without changing ordinary species names", () => {
    expect(mega).toHaveLength(97);
    expect(overrides.map((entry) => entry.id).sort()).toEqual(mega.map((entry) => entry.id).sort());
    expect(getDisplayNameJa("pokemon", "Meganium")).toBe("メガニウム");
    expect(getDisplayNameJa("pokemon", "Yanmega")).toBe("メガヤンマ");
    expect(getDisplayNameJa("pokemon", "Absol")).toBe("アブソル");
  });

  it.each(mega)("corrects $showdownName across display and resolver paths", (raw) => {
    const option = raw as LocalizedOptionEntry;
    const expected = option.label.split(/\s+/).slice(1).join(" ").replace(/[XYZ]$/, (letter) => String.fromCharCode(letter.charCodeAt(0) + 0xfee0));
    expect(expected.startsWith("メガ")).toBe(true);
    expect(getOptionDisplayNameJa("pokemon", option)).toBe(expected);
    expect(getDisplayNameJa("pokemon", option.showdownName)).toBe(expected);
    const corrected = applyManualLabelOverride("pokemon", option);
    expect(corrected.label).toBe(expected);
    expect(corrected.searchText.split(/\s+/)).not.toContain(option.label.split(/\s+/)[0]);
    const { label: _oldLabel, searchText: _oldSearch, ...before } = option;
    const { label: _newLabel, searchText: _newSearch, ...after } = corrected;
    expect(after).toEqual(before);
    for (const input of [option.showdownName, option.id]) {
      expect(resolveEntity("pokemon", input)).toMatchObject({ status: "exact", canonicalName: option.showdownName,
        calcId: option.id, displayNameJa: expected });
    }
    for (const input of [expected, option.label]) {
      const resolved = resolveEntity("pokemon", input);
      expect(resolved.candidates?.some((candidate) => candidate.canonicalName === option.showdownName && candidate.displayNameJa === expected)).toBe(true);
    }
    const external = resolveShowdownDisplayNameJa("pokemon", option.showdownName);
    expect(external).toMatchObject({ status: "localized", showdownId: option.id,
      displayNameJa: externalFormNames[option.showdownName] ?? expected });
  });

  it.each([
    ["Absol-Mega", "メガアブソル"], ["Aerodactyl-Mega", "メガプテラ"],
    ["Meganium-Mega", "メガメガニウム"], ["Charizard-Mega-X", "メガリザードンＸ"],
    ["Charizard-Mega-Y", "メガリザードンＹ"], ["Absol-Mega-Z", "メガアブソルＺ"],
  ])("retains the exact complete name and calc handoff for %s", (name, expected) => {
    const resolved = resolveEntity("pokemon", expected);
    expect(resolved.canonicalName).toBe(name);
    const input = { attacker: { canonicalName: name, level: 50 }, defender: { canonicalName: "Mew", level: 50 }, move: { canonicalName: "Tackle" } };
    const result = calculateDamage(input);
    expect(formatDamageResultJa(result).attacker.name).toEqual({ canonicalName: name, displayNameJa: expected });
    const gen = Generations.get(9);
    const direct = calculate(gen, new Pokemon(gen, name, { level: 50 }), new Pokemon(gen, "Mew", { level: 50 }), new Move(gen, "Tackle"));
    expect(result.damageRange).toEqual(direct.range());
  });

  it("does not choose among forms that already share a Japanese display name", () => {
    expect(resolveEntity("pokemon", "メガニャオニクス").status).toBe("ambiguous");
    expect(resolveEntity("pokemon", "メガシャリタツ").status).toBe("ambiguous");
    expect(resolveEntity("pokemon", "メガマギアナ").status).toBe("ambiguous");
  });
});
