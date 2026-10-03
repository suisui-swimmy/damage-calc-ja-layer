/** Names/display only. This API does not certify calculation or ruleset support. */
export type ShowdownEntityKind = "pokemon" | "ability" | "type";

export interface ShowdownDictionaryRef {
  kind: ShowdownEntityKind;
  id: string;
  /** Lookup key in the existing Japanese dictionary, never an external ID. */
  canonicalName: string;
}

interface ShowdownIdentity {
  showdownId: string;
  showdownName: string;
  dictionaryRef?: ShowdownDictionaryRef;
}

export type ShowdownDisplayCandidate = ShowdownIdentity & (
  | { status: "localized"; displayNameJa: string; provenance: "existing-dictionary" | "showdown-overlay" }
  | { status: "needs-confirmation" | "unsupported"; reason: string }
);

interface ShowdownDisplayContext {
  input: string;
  /** Showdown toID-style normalization of the original input, also retained for aliases. */
  inputId: string;
  kind: ShowdownEntityKind;
  usage: "display-only";
}

export type ShowdownDisplayResult = ShowdownDisplayContext & (
  | (ShowdownDisplayCandidate & { matchedBy: "name-or-id" | "alias" })
  | { status: "ambiguous"; reason: string; candidates: ShowdownDisplayCandidate[] }
  | { status: "not-found"; reason: "unknown-name-or-id" }
);
