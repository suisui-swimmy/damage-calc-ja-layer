import type {
  EntityKind,
  LocalizedOptionEntry,
  LocalizedOptionPayload,
  ManualJaLabelOverride,
} from "../data/optionTypes";
import typeOptions from "../data/generated/type-options.gen.json";
import jaLabelOverrides from "../data/overrides/ja-label-overrides.json";

const labelOverridesByKey = new Map<string, ManualJaLabelOverride>(
  (jaLabelOverrides.entries as ManualJaLabelOverride[]).map((entry) => [`${entry.kind}:${entry.id}`, entry]),
);

export const applyManualLabelOverride = (
  kind: EntityKind,
  option: LocalizedOptionEntry,
): LocalizedOptionEntry => {
  const override = labelOverridesByKey.get(`${kind}:${option.id}`);
  if (!override) return option;

  const label = override.displayNameJa;
  return {
    ...option,
    label,
    // A corrected label must not keep erroneous form names from the imported snapshot.
    // Intentional legacy inputs belong in ja-aliases.json.
    searchText: `${label} ${label.replace(/\s+/g, "")} ${option.showdownName} ${option.id}`,
    sourceStatus: override.sourceStatus ?? option.sourceStatus,
    ...(override.localizationCategory ? { localizationCategory: override.localizationCategory } : {}),
    ...(override.noteJa ? { noteJa: override.noteJa } : {}),
  };
};

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
  const override = labelOverridesByKey.get(`${kind}:${option.id}`);
  if (override) return override.displayNameJa;

  if (kind === "pokemon") {
    return derivePokemonTypeFormLabelJa(option) ?? option.label;
  }

  return option.label;
};
