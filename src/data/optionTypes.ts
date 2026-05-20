export type EntityKind = "pokemon" | "move" | "item" | "ability" | "nature" | "type";

export type LocalizedOptionKind = `${EntityKind}-options`;

export type SourceStatus =
  | "supported"
  | "adapter-temporary"
  | "needs-confirmation"
  | "unsupported-temporary";

export interface OptionFallback {
  from?: string;
  reason?: string;
  nameSourceStatus?: SourceStatus;
  assetSourceStatus?: SourceStatus;
}

export interface LocalizedOptionEntry {
  id: string;
  label: string;
  showdownName: string;
  searchText: string;
  sourceStatus?: SourceStatus;
  fallback?: OptionFallback;
  artwork?: string;
  type?: string;
  types?: string[];
  category?: string;
  basePower?: number;
  priority?: number;
  target?: string;
  overrideOffensiveStat?: string;
  overrideDefensiveStat?: string;
  tags?: string[];
  plus?: string;
  minus?: string;
  color?: string;
  isBerry?: boolean;
  megaStone?: {
    baseSpecies?: string;
    megaSpecies?: string;
  };
  naturalGift?: {
    type: string;
    basePower: number;
  };
  affectsDamage?: boolean;
  calcAvailable?: boolean;
  supportMatrixId?: string;
}

export interface LocalizedOptionPayload<TKind extends string = LocalizedOptionKind> {
  schemaVersion: number;
  dataVersion: string;
  source: Record<string, string | number | boolean>;
  generatedBy: string;
  kind: TKind;
  entries: LocalizedOptionEntry[];
  summary: Record<string, string | number | boolean>;
}

export interface ManualJaAliasOverride {
  kind: EntityKind;
  id: string;
  aliasesJa: string[];
  sourceStatus?: SourceStatus;
  notes?: string;
}

export interface ManualJaLabelOverride {
  kind: EntityKind;
  id: string;
  displayNameJa: string;
  sourceStatus?: SourceStatus;
  notes?: string;
}

export interface ManualJaOverridePayload<TKind extends string, TEntry> {
  schemaVersion: number;
  dataVersion: string;
  source: Record<string, string | number | boolean>;
  generatedBy: string;
  kind: TKind;
  entries: TEntry[];
  summary: Record<string, string | number | boolean>;
}
