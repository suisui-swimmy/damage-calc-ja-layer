import pokemonOptions from "../data/generated/pokemon-options.gen.json";
import abilityOptions from "../data/generated/ability-options.gen.json";
import typeOptions from "../data/generated/type-options.gen.json";
import mapping from "../data/generated/showdown-display.gen.json";
import type { LocalizedOptionEntry } from "../data/optionTypes";
import { getOptionDisplayNameJa } from "./displayNameRules";
import type { ShowdownDisplayCandidate, ShowdownDisplayResult, ShowdownEntityKind } from "./showdownTypes";

const dictionaries = {
  pokemon: new Map<string, LocalizedOptionEntry>(pokemonOptions.entries.map((entry) => [entry.showdownName, entry as LocalizedOptionEntry])),
  ability: new Map<string, LocalizedOptionEntry>(abilityOptions.entries.map((entry) => [entry.showdownName, entry as LocalizedOptionEntry])),
  type: new Map<string, LocalizedOptionEntry>(typeOptions.entries.map((entry) => [entry.showdownName, entry as LocalizedOptionEntry])),
};
const normalizeName = (input: string): string => input.trim().normalize("NFC").toLowerCase();
const toShowdownId = (input: string): string => input.toLowerCase().replace(/[^a-z0-9]/g, "");
const key = (kind: ShowdownEntityKind, id: string): string => `${kind}:${id}`;

// No resolver calls: its aliases, fuzzy search and calc-specific entries are a different contract.
const entries = new Map<string, ShowdownDisplayCandidate>();
const names = new Map<string, string>();
for (const entry of mapping.entries) {
  const kind = entry.kind as ShowdownEntityKind;
  const { kind: _kind, ...value } = entry;
  let candidate: ShowdownDisplayCandidate;
  if (value.status === "localized" && value.dictionaryRef) {
    const option = dictionaries[kind].get(value.dictionaryRef.canonicalName);
    if (!option || option.id !== value.dictionaryRef.id) {
      throw new Error(`Stale Showdown dictionary reference: ${kind}:${value.showdownId}`);
    }
    candidate = { ...value, displayNameJa: getOptionDisplayNameJa(kind, option) } as ShowdownDisplayCandidate;
  } else {
    candidate = value as ShowdownDisplayCandidate;
  }
  entries.set(key(kind, value.showdownId), candidate);
  names.set(key(kind, normalizeName(value.showdownName)), value.showdownId);
}
const aliases = new Map(mapping.aliases.map((entry) => [key(entry.kind as ShowdownEntityKind, entry.inputId), entry.targetId]));
const ambiguities = new Map(mapping.ambiguities.map((entry) => [key(entry.kind as ShowdownEntityKind, entry.inputId), entry]));

// Keep returned objects independent of the internal index, even in JavaScript callers.
const copyCandidate = (candidate: ShowdownDisplayCandidate): ShowdownDisplayCandidate => ({
  ...candidate,
  ...(candidate.dictionaryRef ? { dictionaryRef: { ...candidate.dictionaryRef } } : {}),
});

export const resolveShowdownDisplayNameJa = (
  kind: ShowdownEntityKind,
  input: string,
): ShowdownDisplayResult => {
  const inputId = toShowdownId(input);
  const context = { input, inputId, kind, usage: "display-only" as const };
  const nameId = names.get(key(kind, normalizeName(input)));
  // Do not turn e.g. "日本語Pikachu" into a successful lookup by deleting Japanese text.
  const lookupId = nameId ?? (/^[a-z0-9 .:'-]+$/i.test(input.trim()) ? inputId : "");
  const entry = entries.get(key(kind, lookupId));
  if (entry) return { ...context, ...copyCandidate(entry), matchedBy: "name-or-id" };

  const ambiguity = ambiguities.get(key(kind, lookupId));
  if (ambiguity) return {
    ...context, status: "ambiguous", reason: ambiguity.reason,
    candidates: ambiguity.targetIds.map((id) => copyCandidate(entries.get(key(kind, id))!)),
  };
  const targetId = aliases.get(key(kind, lookupId));
  if (targetId) return { ...context, ...copyCandidate(entries.get(key(kind, targetId))!), matchedBy: "alias" };
  return { ...context, status: "not-found", reason: "unknown-name-or-id" };
};

export const showdownDisplayMetadata = {
  schemaVersion: mapping.schemaVersion,
  dataVersion: mapping.dataVersion,
  showdownCommit: mapping.source.showdownCommit,
  usage: "display-only",
  summary: mapping.summary,
} as const;
