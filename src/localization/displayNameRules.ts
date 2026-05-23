import type { EntityKind, LocalizedOptionEntry, LocalizedOptionPayload } from "../data/optionTypes";
import typeOptions from "../data/generated/type-options.gen.json";

const typeOptionPayload = typeOptions as LocalizedOptionPayload<"type-options">;
const typeLabelByCanonicalName = new Map(
  typeOptionPayload.entries.map((entry) => [entry.showdownName, entry.label]),
);

const pokemonTypeFormBaseLabels: Record<string, string> = {
  Arceus: "アルセウス",
  Silvally: "シルヴァディ",
};

const derivePokemonTypeFormLabelJa = (option: LocalizedOptionEntry): string | undefined => {
  const [baseName, typeName, ...rest] = option.showdownName.split("-");

  if (!baseName || !typeName || rest.length > 0) {
    return undefined;
  }

  const baseLabel = pokemonTypeFormBaseLabels[baseName];
  const typeLabel = typeLabelByCanonicalName.get(typeName);

  if (!baseLabel || !typeLabel) {
    return undefined;
  }

  return `${baseLabel} ${typeLabel}タイプ`;
};

export const getOptionDisplayNameJa = (
  kind: EntityKind,
  option: LocalizedOptionEntry,
): string => {
  if (kind === "pokemon") {
    return derivePokemonTypeFormLabelJa(option) ?? option.label;
  }

  return option.label;
};
