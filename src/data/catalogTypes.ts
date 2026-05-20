import type { EntityKind } from "./optionTypes";

export interface CalcCatalogPayload<TEntry extends CalcCatalogEntry = CalcCatalogEntry> {
  schemaVersion: number;
  dataVersion: string;
  source: Record<string, string | number | boolean>;
  generatedBy: string;
  kind: EntityKind;
  entries: TEntry[];
  summary: Record<string, string | number | boolean>;
}

export interface CalcCatalogEntry {
  id: string;
  kind: EntityKind;
  showdownName: string;
}

export interface CalcSpeciesCatalogEntry extends CalcCatalogEntry {
  kind: "pokemon";
  types?: string[];
  baseStats?: Record<string, number>;
  weightkg?: number;
  nfe?: boolean;
  gender?: string;
  baseSpecies?: string;
  otherFormes?: string[];
  abilities?: string[];
}

export interface CalcMoveCatalogEntry extends CalcCatalogEntry {
  kind: "move";
  type?: string;
  category?: string;
  basePower?: number;
  priority?: number;
  target?: string;
  flags?: Record<string, number>;
  multihit?: number | number[];
}

export interface CalcItemCatalogEntry extends CalcCatalogEntry {
  kind: "item";
  isBerry?: boolean;
  megaStone?: Record<string, string>;
  naturalGift?: {
    basePower: number;
    type: string;
  };
}

export interface CalcAbilityCatalogEntry extends CalcCatalogEntry {
  kind: "ability";
}

export interface CalcNatureCatalogEntry extends CalcCatalogEntry {
  kind: "nature";
  plus?: string;
  minus?: string;
}

export interface CalcTypeCatalogEntry extends CalcCatalogEntry {
  kind: "type";
}
