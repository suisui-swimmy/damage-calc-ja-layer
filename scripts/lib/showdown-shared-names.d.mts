export interface SharedDisplayNameGroup {
  kind: string;
  displayNameJa: string;
  showdownIds: string[];
  sources: string[];
  verifiedOn: string;
}
export interface DisplayNameEntry {
  kind: string;
  showdownId: string;
  status: string;
  variantLabelJa?: string;
}
export function validateSharedDisplayNames<T extends DisplayNameEntry>(
  groups: SharedDisplayNameGroup[], entries: T[], labelOf: (entry: T) => string,
): Set<string>;
