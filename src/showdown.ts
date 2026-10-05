/** Public entry point for external Pokemon Showdown names/IDs. No calculation API. */
export { resolveShowdownDisplayNameJa, showdownDisplayMetadata } from "./localization/showdownDisplay";
/** Explicit empty-selection UI text. Not a Showdown move or an unknown-input fallback. */
export const showdownUiLabels = Object.freeze({ noMove: "技なし" } as const);
export type {
  ShowdownDictionaryRef,
  ShowdownDisplayCandidate,
  ShowdownDisplayResult,
  ShowdownEntityKind,
  ShowdownScopeCategory,
} from "./localization/showdownTypes";
