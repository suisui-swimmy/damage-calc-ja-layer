import { describe, expect, it } from "vitest";
import { resolveShowdownDisplayNameJa as lookup, showdownDisplayMetadata } from "../showdown";
import type { ShowdownEntityKind } from "../showdown";
import overlay from "../data/overrides/showdown-display-overrides.json";
import { getDisplayNameJa, resolveEntity } from "./resolver";

const idOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
const totems = [
  ["Araquanid-Totem", "オニシズクモ"], ["Gumshoos-Totem", "デカグース"],
  ["Kommo-o-Totem", "ジャラランガ"], ["Lurantis-Totem", "ラランテス"],
  ["Ribombee-Totem", "アブリボン"], ["Salazzle-Totem", "エンニュート"],
  ["Togedemaru-Totem", "トゲデマル"], ["Vikavolt-Totem", "クワガノン"],
] as const;
const scoped = overlay.outOfScopeGroups.flatMap((group) =>
  group.entries.map((entry) => ({ ...entry, kind: group.kind, category: group.category })),
);

describe("reviewed Showdown display scope", () => {
  it.each(totems)("labels %s without changing its external identity or calc dictionary", (name, label) => {
    for (const input of [name, idOf(name)]) {
      const result = lookup("pokemon", input);
      expect(result).toMatchObject({ status: "localized", inputId: idOf(name), showdownId: idOf(name),
        showdownName: name, displayNameJa: `${label}（ぬし）`, labelKind: "ui-label", usage: "display-only",
        dictionaryRef: { canonicalName: name.slice(0, -6) },
      });
      expect(result).not.toHaveProperty("displaySuffixJa");
    }
    expect(getDisplayNameJa("pokemon", name)).toBe(label);
    expect(resolveEntity("pokemon", name)).toMatchObject({ status: "exact", canonicalName: name, calcId: idOf(name) });
  });

  it("returns No Ability as an explicit UI label, not a missing or disabled ability", () => {
    for (const input of ["No Ability", "noability"]) expect(lookup("ability", input)).toMatchObject({
      status: "localized", showdownName: "No Ability", showdownId: "noability", displayNameJa: "特性なし", labelKind: "ui-label",
    });
    for (const input of ["", "none", "disabled"]) expect(lookup("ability", input).status).toBe("not-found");
    expect(resolveEntity("ability", "No Ability").status).toBe("not-found");
    expect(getDisplayNameJa("ability", "No Ability")).toBe("No Ability");
  });

  it("keeps all 120 reviewed entries recognizable with original names and Japanese notes", () => {
    expect(scoped).toHaveLength(120);
    for (const entry of scoped) {
      const category = entry.category;
      const noteJa = category === "pokestar" ? "ポケウッドの登場データ" : category === "glitch" ? "初代作品のバグ由来データ"
        : entry.kind === "ability" ? "Smogon CAPの創作特性" : "Smogon CAPの創作ポケモン";
      for (const input of [entry.showdownName, entry.showdownId]) {
        const result = lookup(entry.kind as ShowdownEntityKind, input);
        expect(result).toMatchObject({ status: "out-of-scope", reason: "outside-localization-scope", category, noteJa,
          input, inputId: idOf(input), showdownId: entry.showdownId, showdownName: entry.showdownName, usage: "display-only" });
        expect(result).not.toHaveProperty("displayNameJa");
      }
    }
  });

  it("does not classify unknown names by prefix or suffix", () => {
    for (const name of ["Pokestar Unknown", "Unknown-Totem", "Pikachu-Totem", "MissingNo.-Unknown", "CAP Unknown"]) {
      expect(lookup("pokemon", name).status).toBe("not-found");
    }
    expect(lookup("ability", "CAP Unknown").status).toBe("not-found");
    expect(lookup("pokemon", "Mountaineer").status).toBe("not-found");
  });

  it("does not approve unreviewed forms when adding the reviewed scope rules", () => {
    for (const name of ["Marowak-Alola-Totem", "Mimikyu-Busted-Totem", "Mimikyu-Totem", "Raticate-Alola-Totem"]) {
      expect(lookup("pokemon", name)).toMatchObject({ status: "needs-confirmation", reason: "unverified-dictionary-label" });
    }
    for (const name of ["Darmanitan-Zen", "Darmanitan-Galar-Zen"]) {
      expect(lookup("pokemon", name)).toMatchObject({ status: "needs-confirmation", reason: "non-distinct-form-label" });
    }
    expect(lookup("pokemon", "Pichu-Spiky-eared")).toMatchObject({ status: "unsupported", reason: "missing-japanese-mapping" });
  });

  it("distinguishes the reviewed categories and publishes the new status schema", () => {
    const examples = [
      ["ability", "Mountaineer", "cap"], ["pokemon", "Ababo", "cap"],
      ["pokemon", "Flox", "cap"], ["pokemon", "Pokestar Black Belt", "pokestar"],
      ["pokemon", "MissingNo.", "glitch"],
    ] as const;
    for (const [kind, name, category] of examples) {
      expect(lookup(kind, name)).toMatchObject({ status: "out-of-scope", category, showdownName: name });
    }
    expect(showdownDisplayMetadata.schemaVersion).toBe(2);
    expect(showdownDisplayMetadata.summary.pokemon["out-of-scope"]).toBe(117);
    expect(showdownDisplayMetadata.summary.ability["out-of-scope"]).toBe(3);
  });
});
