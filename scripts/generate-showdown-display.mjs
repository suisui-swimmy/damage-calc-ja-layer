import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pokemonNameOverrides } from "./lib/showdown-pokemon-names.mjs";

const root = new URL("../", import.meta.url);
const hashes = {};
const read = async (path) => {
  const data = JSON.parse(await readFile(new URL(path, root), "utf8"));
  // JSON content hashes survive Git's Windows CRLF checkout conversion.
  hashes[path] = createHash("sha256").update(JSON.stringify(data)).digest("hex");
  return data;
};
const catalog = await read("src/data/generated/showdown-catalog.gen.json");
const sourceLock = await read("scripts/data/showdown-source.lock.json");
assert.deepEqual(catalog.source, sourceLock, "Catalog source lock mismatch");
const overlay = await read("src/data/overrides/showdown-display-overrides.json");
const pokemonNames = await read("src/data/overrides/showdown-pokemon-names.json");
const labels = await read("src/data/overrides/ja-label-overrides.json");
const displayRulesPath = "src/localization/displayNameRules.ts";
hashes[displayRulesPath] = createHash("sha256").update((await readFile(new URL(displayRulesPath, root), "utf8")).replace(/\r\n/g, "\n")).digest("hex");
assert.equal(catalog.schemaVersion, 1);
assert.equal(overlay.schemaVersion, 1);
assert.equal(overlay.showdownCommit, catalog.source.commit, "Review overlays when updating Showdown");
const toID = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
const key = (entry) => `${entry.kind}:${entry.showdownId}`;
const known = new Map(catalog.entries.map((entry) => [key(entry), entry]));
assert.equal(known.size, catalog.entries.length, "Duplicate Showdown IDs");
const allOverrides = [...overlay.entries, ...pokemonNameOverrides(pokemonNames, catalog)];
const overrides = new Map(allOverrides.map((entry) => [key(entry), entry]));
assert.equal(overrides.size, allOverrides.length, "Duplicate overrides");
const outOfScope = new Map();
for (const group of overlay.outOfScopeGroups ?? []) {
  assert(["cap", "pokestar", "glitch"].includes(group.category), "Unknown scope category");
  assert(["pokemon", "ability"].includes(group.kind), "Invalid scope kind");
  assert(group.category === "cap" || group.kind === "pokemon", "Special species category on an ability");
  assert(group.noteJa && group.sources?.length && group.evidence?.checkedOn, "Missing scope review evidence");
  for (const entry of group.entries) {
    const scopedKey = key({ ...entry, kind: group.kind });
    assert(known.has(scopedKey), `Unknown scope ID: ${scopedKey}`);
    assert.equal(known.get(scopedKey).showdownName, entry.showdownName);
    assert(!overrides.has(scopedKey) && !outOfScope.has(scopedKey), `Conflicting scope rule: ${scopedKey}`);
    outOfScope.set(scopedKey, { category: group.category, noteJa: group.noteJa });
  }
}
const dictionaries = {};
for (const kind of ["pokemon", "ability", "type"]) {
  const data = await read(`src/data/generated/${kind}-options.gen.json`);
  dictionaries[kind] = new Map(data.entries.map((entry) => [entry.showdownName, entry]));
}
for (const entry of allOverrides) {
  assert(known.has(key(entry)), `Override missing in Showdown: ${key(entry)}`);
  assert.equal(entry.showdownName, known.get(key(entry)).showdownName);
  assert(entry.sources?.length > 0, `Missing provenance: ${key(entry)}`);
  assert(Boolean(entry.dictionaryName) !== Boolean(entry.displayNameJa), `Choose dictionary or literal: ${key(entry)}`);
  if (entry.labelKind !== undefined) assert.equal(entry.labelKind, "ui-label");
  if (entry.displaySuffixJa !== undefined) {
    assert(entry.dictionaryName && !entry.displayNameJa && entry.labelKind === "ui-label");
    assert.equal(entry.displaySuffixJa, "（ぬし）");
    assert.equal(known.get(key(entry)).baseSpecies, entry.dictionaryName, "Totem dictionary must refer to the reviewed base species");
  }
}
const entries = catalog.entries.map((entry) => {
  const result = { kind: entry.kind, showdownId: entry.showdownId, showdownName: entry.showdownName };
  const scope = outOfScope.get(key(entry));
  if (scope) return { ...result, status: "out-of-scope", reason: "outside-localization-scope", ...scope };
  const override = overrides.get(key(entry));
  const dictionaryName = override?.dictionaryName ?? entry.showdownName;
  const option = dictionaries[entry.kind].get(dictionaryName);
  const labelOverride = option && labels.entries.find((label) => label.kind === entry.kind && label.id === option.id);
  if (override?.dictionaryName) assert(option, `Missing dictionary reference: ${dictionaryName}`);
  const displayMetadata = override?.labelKind ? { labelKind: override.labelKind, noteJa: override.noteJa } : {};
  if (override?.displayNameJa) {
    assert(/[\u3040-\u30ff\u3400-\u9fff]/u.test(override.displayNameJa));
    return { ...result, status: "localized", displayNameJa: override.displayNameJa, provenance: "showdown-overlay", ...displayMetadata };
  }
  if (!option) return { ...result, status: "unsupported", reason: "missing-japanese-mapping" };
  // A matching English name does not certify a base-form fallback as a form translation.
  const sourceStatus = option.sourceStatus ?? option.fallback?.nameSourceStatus ?? "supported";
  const verified = override || labelOverride || sourceStatus === "supported";
  const japanese = /[\u3040-\u30ff\u3400-\u9fff]/u.test(labelOverride?.displayNameJa ?? option.label);
  const dictionaryRef = { kind: entry.kind, id: option.id, canonicalName: option.showdownName };
  if (!verified || !japanese) return { ...result, status: "needs-confirmation", dictionaryRef, reason: "unverified-dictionary-label" };
  return { ...result, status: "localized", dictionaryRef, provenance: override ? "showdown-overlay" : "existing-dictionary",
    ...displayMetadata, ...(override?.displaySuffixJa ? { displaySuffixJa: override.displaySuffixJa } : {}) };
});
// Some imported labels lack fallback flags but still collapse distinct forms.
// Keep the ordinary species display; withhold any indistinguishable form labels.
const labelsToEntries = new Map();
for (const entry of entries.filter((entry) => entry.status === "localized")) {
  const option = entry.dictionaryRef && dictionaries[entry.kind].get(entry.dictionaryRef.canonicalName);
  const label = (entry.displayNameJa ?? labels.entries.find((value) => value.kind === entry.kind && value.id === option.id)?.displayNameJa ?? option.label) + (entry.displaySuffixJa ?? "");
  const labelKey = `${entry.kind}:${label}`;
  labelsToEntries.set(labelKey, [...(labelsToEntries.get(labelKey) ?? []), entry]);
}
for (const group of labelsToEntries.values()) {
  if (group.length < 2) continue;
  for (const entry of group) {
    const source = known.get(key(entry));
    if (source.baseSpecies || source.forme || source.isCosmeticForme) {
      assert(!overrides.has(key(entry)), `Explicit mapping has a non-distinct form label: ${key(entry)}`);
      entry.status = "needs-confirmation";
      entry.reason = "non-distinct-form-label";
      delete entry.displayNameJa;
      delete entry.provenance;
    }
  }
}
const byKey = new Map(entries.map((entry) => [key(entry), entry]));
const aliasKeys = new Set();
for (const alias of overlay.aliases) {
  const aliasKey = `${alias.kind}:${alias.inputId}`;
  assert(!aliasKeys.has(aliasKey) && !known.has(aliasKey), `Alias collision: ${aliasKey}`);
  aliasKeys.add(aliasKey);
  assert(byKey.has(`${alias.kind}:${alias.targetId}`));
  assert.equal(toID(catalog.aliases[alias.inputId] ?? ""), alias.targetId, `Upstream alias changed: ${alias.inputId}`);
}
for (const ambiguity of overlay.ambiguities) {
  const ambiguityKey = `${ambiguity.kind}:${ambiguity.inputId}`;
  assert(!known.has(ambiguityKey) && !aliasKeys.has(ambiguityKey));
  aliasKeys.add(ambiguityKey);
  assert(new Set(ambiguity.targetIds).size > 1);
  for (const id of ambiguity.targetIds) assert(byKey.has(`${ambiguity.kind}:${id}`));
}
const vivillon = known.get("pokemon:vivillon");
assert.equal(vivillon.baseForme, "Meadow", "Review bare Vivillon semantics");
const formNames = ["Vivillon", ...vivillon.cosmeticFormes, ...vivillon.otherFormes];
assert.deepEqual([...formNames].sort(), [...vivillon.formeOrder].sort(), "Vivillon form lists disagree");
const mappedForms = overlay.entries.filter((entry) => entry.kind === "pokemon" && entry.showdownName.startsWith("Vivillon"));
assert.deepEqual(mappedForms.map((entry) => entry.showdownName).sort(), [...formNames].sort(), "Vivillon overlay coverage mismatch");
for (const name of formNames) assert.equal(byKey.get(`pokemon:${toID(name)}`).status, "localized");
const summary = Object.fromEntries(["pokemon", "ability", "type"].map((kind) => [kind,
  Object.fromEntries(["localized", "needs-confirmation", "unsupported", "out-of-scope"].map((status) => [status, entries.filter((entry) => entry.kind === kind && entry.status === status).length]))]));
const payload = {
  schemaVersion: 2, dataVersion: `showdown-display-${createHash("sha256").update(JSON.stringify(hashes)).digest("hex").slice(0, 16)}`,
  source: { showdownCommit: catalog.source.commit, overlayVersion: overlay.dataVersion, sha256: hashes },
  generatedBy: "scripts/generate-showdown-display.mjs", kind: "showdown-display-mapping", usage: "display-only",
  entries, aliases: overlay.aliases, ambiguities: overlay.ambiguities, summary,
};
const output = new URL("src/data/generated/showdown-display.gen.json", root);
const text = JSON.stringify(payload, null, 2) + "\n";
if (process.argv.includes("--check")) assert.equal((await readFile(output, "utf8")).replace(/\r\n/g, "\n"), text, "Run npm run generate:showdown-display");
else await writeFile(output, text);
console.log(JSON.stringify(summary));
