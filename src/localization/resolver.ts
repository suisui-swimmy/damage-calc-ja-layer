import abilityOptions from "../data/generated/ability-options.gen.json";
import itemOptions from "../data/generated/item-options.gen.json";
import moveOptions from "../data/generated/move-options.gen.json";
import natureOptions from "../data/generated/nature-options.gen.json";
import pokemonOptions from "../data/generated/pokemon-options.gen.json";
import typeOptions from "../data/generated/type-options.gen.json";
import type {
  EntityKind,
  LocalizedOptionEntry,
  LocalizedOptionPayload,
  SourceStatus,
} from "../data/optionTypes";
import { normalizeJaSearchText, toCalcId } from "./normalizeJa";

export type ResolveStatus = "exact" | "alias" | "fuzzy" | "ambiguous" | "not-found";

export interface ResolveCandidate {
  canonicalName: string;
  displayNameJa: string;
  reason: string;
  calcId: string;
  sourceStatus: SourceStatus;
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

type MatchReason = "label" | "canonical" | "id" | "searchText";

interface SearchEntry {
  option: LocalizedOptionEntry;
  reason: MatchReason;
}

const payloadByKind: Record<EntityKind, LocalizedOptionPayload> = {
  pokemon: pokemonOptions as unknown as LocalizedOptionPayload,
  move: moveOptions as unknown as LocalizedOptionPayload,
  item: itemOptions as unknown as LocalizedOptionPayload,
  ability: abilityOptions as unknown as LocalizedOptionPayload,
  nature: natureOptions as unknown as LocalizedOptionPayload,
  type: typeOptions as unknown as LocalizedOptionPayload,
};

const sourceStatusOf = (option: LocalizedOptionEntry): SourceStatus =>
  option.sourceStatus ?? option.fallback?.nameSourceStatus ?? "supported";

const candidateFromOption = (
  option: LocalizedOptionEntry,
  reason: string,
): ResolveCandidate => ({
  canonicalName: option.showdownName,
  displayNameJa: option.label,
  reason,
  calcId: option.id,
  sourceStatus: sourceStatusOf(option),
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

const buildIndex = (entries: LocalizedOptionEntry[]) => {
  const exactIndex = new Map<string, SearchEntry[]>();
  const aliasIndex = new Map<string, SearchEntry[]>();

  for (const option of entries) {
    addIndexValue(exactIndex, option.label, { option, reason: "label" });
    addIndexValue(exactIndex, option.showdownName, { option, reason: "canonical" });
    addIndexValue(exactIndex, option.id, { option, reason: "id" });
    addIndexValue(exactIndex, toCalcId(option.showdownName), {
      option,
      reason: "canonical",
    });

    for (const token of option.searchText.split(/\s+/)) {
      addIndexValue(aliasIndex, token, { option, reason: "searchText" });
    }
  }

  return { exactIndex, aliasIndex, entries };
};

const searchByKind = Object.fromEntries(
  Object.entries(payloadByKind).map(([kind, payload]) => [kind, buildIndex(payload.entries)]),
) as Record<EntityKind, ReturnType<typeof buildIndex>>;

const resolveMatches = (
  kind: EntityKind,
  input: string,
  matches: SearchEntry[],
  status: ResolveStatus,
): ResolveResult => {
  const candidates = matches.map(({ option, reason }) =>
    candidateFromOption(option, reason),
  );

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
      .map((option) => ({ option, reason: "searchText" as const }));

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
