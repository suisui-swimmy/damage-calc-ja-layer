import abilityOptions from "../data/generated/ability-options.gen.json";
import itemOptions from "../data/generated/item-options.gen.json";
import moveOptions from "../data/generated/move-options.gen.json";
import natureOptions from "../data/generated/nature-options.gen.json";
import pokemonOptions from "../data/generated/pokemon-options.gen.json";
import typeOptions from "../data/generated/type-options.gen.json";
import jaAliases from "../data/overrides/ja-aliases.json";
import jaLabelOverrides from "../data/overrides/ja-label-overrides.json";
import { getOptionDisplayNameJa } from "./displayNameRules";
import type {
  EntityKind,
  LocalizedOptionEntry,
  LocalizedOptionPayload,
  ManualJaAliasOverride,
  ManualJaLabelOverride,
  ManualJaOverridePayload,
  SourceStatus,
} from "../data/optionTypes";
import { normalizeJaSearchText, toCalcId } from "./normalizeJa";

export type ResolveStatus = "exact" | "alias" | "fuzzy" | "ambiguous" | "not-found";
export type ResolveMatchedBy = "label" | "canonical" | "id" | "searchText" | "manualAlias" | "fuzzy";

export interface ResolveCandidate {
  canonicalName: string;
  displayNameJa: string;
  reason: string;
  calcId: string;
  sourceStatus: SourceStatus;
  matchedBy: ResolveMatchedBy;
  matchText: string;
}

export interface ResolveResult {
  status: ResolveStatus;
  input: string;
  kind: EntityKind;
  canonicalName?: string;
  calcId?: string;
  displayNameJa?: string;
  sourceStatus?: SourceStatus;
  candidates?: ResolveCandidate[];
}

export interface ResolveOptions {
  allowFuzzy?: boolean;
}

interface SearchEntry {
  kind: EntityKind;
  option: LocalizedOptionEntry;
  matchedBy: ResolveMatchedBy;
  matchText: string;
  sourceStatus?: SourceStatus;
}

const payloadByKind: Record<EntityKind, LocalizedOptionPayload> = {
  pokemon: pokemonOptions as unknown as LocalizedOptionPayload,
  move: moveOptions as unknown as LocalizedOptionPayload,
  item: itemOptions as unknown as LocalizedOptionPayload,
  ability: abilityOptions as unknown as LocalizedOptionPayload,
  nature: natureOptions as unknown as LocalizedOptionPayload,
  type: typeOptions as unknown as LocalizedOptionPayload,
};

const aliasOverridePayload =
  jaAliases as ManualJaOverridePayload<"ja-alias-overrides", ManualJaAliasOverride>;
const labelOverridePayload =
  jaLabelOverrides as ManualJaOverridePayload<"ja-label-overrides", ManualJaLabelOverride>;

const aliasOverridesByKey = new Map(
  aliasOverridePayload.entries.map((entry) => [`${entry.kind}:${entry.id}`, entry]),
);

const labelOverridesByKey = new Map(
  labelOverridePayload.entries.map((entry) => [`${entry.kind}:${entry.id}`, entry]),
);

const sourceStatusOf = (
  option: LocalizedOptionEntry,
  overrideSourceStatus?: SourceStatus,
): SourceStatus =>
  overrideSourceStatus ?? option.sourceStatus ?? option.fallback?.nameSourceStatus ?? "supported";

const reasonByMatchedBy: Record<ResolveMatchedBy, string> = {
  label: "label exact match",
  canonical: "canonical name exact match",
  id: "calcId exact match",
  searchText: "searchText token match",
  manualAlias: "manual alias match",
  fuzzy: "searchText fuzzy match",
};

const candidateFromSearchEntry = (entry: SearchEntry): ResolveCandidate => ({
  canonicalName: entry.option.showdownName,
  displayNameJa: getOptionDisplayNameJa(entry.kind, entry.option),
  reason: reasonByMatchedBy[entry.matchedBy],
  calcId: entry.option.id,
  sourceStatus: sourceStatusOf(entry.option, entry.sourceStatus),
  matchedBy: entry.matchedBy,
  matchText: entry.matchText,
});

const addIndexValue = (
  index: Map<string, SearchEntry[]>,
  key: string,
  value: SearchEntry,
) => {
  const normalized = normalizeJaSearchText(key);
  if (!normalized) {
    return;
  }
  const current = index.get(normalized) ?? [];
  if (!current.some(({ option }) => option.id === value.option.id)) {
    current.push(value);
  }
  index.set(normalized, current);
};

const buildIndex = (kind: EntityKind, entries: LocalizedOptionEntry[]) => {
  const exactIndex = new Map<string, SearchEntry[]>();
  const aliasIndex = new Map<string, SearchEntry[]>();

  for (const option of entries) {
    const displayNameJa = getOptionDisplayNameJa(kind, option);

    addIndexValue(exactIndex, displayNameJa, {
      kind,
      option,
      matchedBy: "label",
      matchText: displayNameJa,
    });
    addIndexValue(exactIndex, option.showdownName, {
      kind,
      option,
      matchedBy: "canonical",
      matchText: option.showdownName,
    });
    addIndexValue(exactIndex, option.id, { kind, option, matchedBy: "id", matchText: option.id });
    addIndexValue(exactIndex, toCalcId(option.showdownName), {
      kind,
      option,
      matchedBy: "canonical",
      matchText: toCalcId(option.showdownName),
    });

    for (const token of option.searchText.split(/\s+/)) {
      addIndexValue(aliasIndex, token, {
        kind,
        option,
        matchedBy: "searchText",
        matchText: token,
      });
    }

    const aliasOverride = aliasOverridesByKey.get(`${kind}:${option.id}`);
    for (const alias of aliasOverride?.aliasesJa ?? []) {
      addIndexValue(aliasIndex, alias, {
        kind,
        option,
        matchedBy: "manualAlias",
        matchText: alias,
        sourceStatus: aliasOverride?.sourceStatus,
      });
    }
  }

  return { exactIndex, aliasIndex, entries };
};

const applyManualOverrides = (
  kind: EntityKind,
  entries: LocalizedOptionEntry[],
): LocalizedOptionEntry[] =>
  entries.map((entry) => {
    const key = `${kind}:${entry.id}`;
    const labelOverride = labelOverridesByKey.get(key);
    const displayNameJa = labelOverride?.displayNameJa;

    if (displayNameJa === undefined && labelOverride?.sourceStatus === undefined) {
      return entry;
    }

    return {
      ...entry,
      kind,
      label: displayNameJa ?? entry.label,
      sourceStatus: labelOverride?.sourceStatus ?? entry.sourceStatus,
    };
  });

const searchByKind = Object.fromEntries(
  Object.entries(payloadByKind).map(([kind, payload]) => [
    kind,
    buildIndex(kind as EntityKind, applyManualOverrides(kind as EntityKind, payload.entries)),
  ]),
) as Record<EntityKind, ReturnType<typeof buildIndex>>;

const resolveMatches = (
  kind: EntityKind,
  input: string,
  matches: SearchEntry[],
  status: ResolveStatus,
): ResolveResult => {
  const candidates = matches.map(candidateFromSearchEntry);

  if (candidates.length === 1 && status !== "ambiguous") {
    const [candidate] = candidates;
    return {
      status,
      input,
      kind,
      canonicalName: candidate.canonicalName,
      calcId: candidate.calcId,
      displayNameJa: candidate.displayNameJa,
      sourceStatus: candidate.sourceStatus,
      candidates,
    };
  }

  return {
    status: "ambiguous",
    input,
    kind,
    candidates,
  };
};

export const resolveEntity = (
  kind: EntityKind,
  input: string,
  options: ResolveOptions = {},
): ResolveResult => {
  const normalized = normalizeJaSearchText(input);
  const search = searchByKind[kind];

  if (!normalized) {
    return { status: "not-found", input, kind };
  }

  const exactMatches = search.exactIndex.get(normalized);
  if (exactMatches) {
    return resolveMatches(kind, input, exactMatches, "exact");
  }

  const aliasMatches = search.aliasIndex.get(normalized);
  if (aliasMatches) {
    return resolveMatches(kind, input, aliasMatches, "alias");
  }

  if (options.allowFuzzy) {
    const fuzzyMatches = search.entries
      .filter((entry) => normalizeJaSearchText(entry.searchText).includes(normalized))
      .slice(0, 10)
      .map((option) => ({
        kind,
        option,
        matchedBy: "fuzzy" as const,
        matchText: input,
      }));

    if (fuzzyMatches.length > 0) {
      return resolveMatches(kind, input, fuzzyMatches, "fuzzy");
    }
  }

  return { status: "not-found", input, kind };
};

export const getDisplayNameJa = (
  kind: EntityKind,
  canonicalName: string,
): string => {
  const result = resolveEntity(kind, canonicalName);
  return result.displayNameJa ?? canonicalName;
};
