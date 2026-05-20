export type EntityKind = "pokemon" | "move" | "item" | "ability" | "nature" | "type";

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
  type?: string;
  types?: string[];
  category?: string;
  basePower?: number;
  priority?: number;
  tags?: string[];
  plus?: string;
  minus?: string;
  color?: string;
}

export interface LocalizedOptionPayload<TKind extends string = string> {
  schemaVersion: number;
  dataVersion: string;
  source: Record<string, string | number | boolean>;
  generatedBy: string;
  kind: TKind;
  entries: LocalizedOptionEntry[];
  summary: Record<string, string | number | boolean>;
}
