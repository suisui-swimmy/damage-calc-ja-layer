import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = 1;

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const generatedDir = resolve(projectRoot, "src/data/generated");
const overridesDir = resolve(projectRoot, "src/data/overrides");

const mappingTargets = [
  {
    kind: "pokemon",
    optionFileName: "pokemon-options.gen.json",
    catalogFileName: "calc-species.gen.json",
  },
  {
    kind: "move",
    optionFileName: "move-options.gen.json",
    catalogFileName: "calc-moves.gen.json",
  },
  {
    kind: "item",
    optionFileName: "item-options.gen.json",
    catalogFileName: "calc-items.gen.json",
  },
  {
    kind: "ability",
    optionFileName: "ability-options.gen.json",
    catalogFileName: "calc-abilities.gen.json",
  },
  {
    kind: "nature",
    optionFileName: "nature-options.gen.json",
    catalogFileName: "calc-natures.gen.json",
  },
  {
    kind: "type",
    optionFileName: "type-options.gen.json",
    catalogFileName: "calc-types.gen.json",
  },
];

const sourceStatusValues = [
  "supported",
  "adapter-temporary",
  "needs-confirmation",
  "unsupported-temporary",
];

const errors = [];
const warnings = [];

const addError = (fileName, message) => {
  errors.push(`${fileName}: ${message}`);
};

const addWarning = (fileName, message) => {
  warnings.push(`${fileName}: ${message}`);
};

const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));

const toCalcId = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const normalizeSearchText = (value) =>
  String(value)
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[\s._・･ー－\-]+/g, "");

const statusOf = (entry) =>
  entry.sourceStatus ?? entry.fallback?.nameSourceStatus ?? "supported";

const createCounter = () => Object.fromEntries(sourceStatusValues.map((status) => [status, 0]));

const increment = (counter, key) => {
  counter[key] = (counter[key] ?? 0) + 1;
};

const sample = (items, limit = 8) => items.slice(0, limit);

const formatDuplicateExample = (key, entries) => {
  const shown = entries
    .slice(0, 8)
    .map((entry) => `${entry.id}@${entry.index}`)
    .join(",");
  const suffix = entries.length > 8 ? `,+${entries.length - 8} more` : "";
  return `${key}: ${shown}${suffix}`;
};

const validatePayloadShape = (fileName, payload, expectedKind) => {
  if (!isRecord(payload)) {
    addError(fileName, "payload must be an object");
    return false;
  }

  if (payload.schemaVersion !== SCHEMA_VERSION) {
    addError(fileName, `schemaVersion must be ${SCHEMA_VERSION}`);
  }
  if (typeof payload.dataVersion !== "string" || payload.dataVersion.length === 0) {
    addError(fileName, "dataVersion must be a non-empty string");
  }
  if (!isRecord(payload.source)) {
    addError(fileName, "source must be an object");
  }
  if (typeof payload.generatedBy !== "string" || payload.generatedBy.length === 0) {
    addError(fileName, "generatedBy must be a non-empty string");
  }
  if (payload.kind !== expectedKind) {
    addError(fileName, `kind must be ${expectedKind}`);
  }
  if (!Array.isArray(payload.entries)) {
    addError(fileName, "entries must be an array");
    return false;
  }
  if (!isRecord(payload.summary)) {
    addError(fileName, "summary must be an object");
  }

  return true;
};

const buildCatalogLookup = (catalogPayload) => {
  const byId = new Map();
  const byShowdownName = new Map();

  for (const entry of catalogPayload.entries) {
    if (!isRecord(entry)) {
      continue;
    }
    if (typeof entry.id === "string") {
      byId.set(entry.id, entry);
    }
    if (typeof entry.showdownName === "string") {
      byShowdownName.set(entry.showdownName, entry);
    }
  }

  return { byId, byShowdownName };
};

const validateOptionEntries = (target, optionsPayload, catalogPayload) => {
  const { optionFileName } = target;
  const catalog = buildCatalogLookup(catalogPayload);
  const optionIds = new Map();
  const optionShowdownNames = new Map();
  const normalizedLabels = new Map();
  const normalizedSearchTokens = new Map();
  const coveredCatalogIds = new Set();
  const summary = {
    kind: target.kind,
    options: optionsPayload.entries.length,
    catalog: catalogPayload.entries.length,
    matchedById: 0,
    matchedByShowdownNameOnly: 0,
    missingFromCatalog: 0,
    catalogMissingJaMapping: 0,
    duplicateIds: 0,
    duplicateShowdownNames: 0,
    duplicateNormalizedLabels: 0,
    duplicateNormalizedSearchTokens: 0,
    emptyLabels: 0,
    emptySearchText: 0,
    emptyShowdownNames: 0,
    idMismatchWithShowdownName: 0,
    sourceStatus: createCounter(),
    fallbackReasons: {},
    missingFromCatalogByStatus: createCounter(),
    examples: {
      missingFromCatalog: [],
      catalogMissingJaMapping: [],
      duplicateIds: [],
      duplicateShowdownNames: [],
      duplicateNormalizedLabels: [],
      duplicateNormalizedSearchTokens: [],
      emptyLabels: [],
      emptySearchText: [],
      idMismatchWithShowdownName: [],
    },
  };

  for (const [index, entry] of optionsPayload.entries.entries()) {
    if (!isRecord(entry)) {
      addError(optionFileName, `entries[${index}] must be an object`);
      continue;
    }

    const id = typeof entry.id === "string" ? entry.id : "";
    const label = typeof entry.label === "string" ? entry.label : "";
    const showdownName = typeof entry.showdownName === "string" ? entry.showdownName : "";
    const searchText = typeof entry.searchText === "string" ? entry.searchText : "";
    const sourceStatus = statusOf(entry);

    increment(summary.sourceStatus, sourceStatus);

    if (entry.fallback?.reason) {
      increment(summary.fallbackReasons, entry.fallback.reason);
    }

    if (!sourceStatusValues.includes(sourceStatus)) {
      addError(optionFileName, `entries[${index}] has unknown sourceStatus ${JSON.stringify(sourceStatus)}`);
    }
    if (!id) {
      addError(optionFileName, `entries[${index}].id must be a non-empty string`);
      continue;
    }
    if (!label.trim()) {
      summary.emptyLabels += 1;
      summary.examples.emptyLabels.push(id);
      addError(optionFileName, `entries[${index}] (${id}) has empty label`);
    }
    if (!showdownName.trim()) {
      summary.emptyShowdownNames += 1;
      addError(optionFileName, `entries[${index}] (${id}) has empty showdownName`);
    }
    if (!searchText.trim()) {
      summary.emptySearchText += 1;
      summary.examples.emptySearchText.push(id);
      addError(optionFileName, `entries[${index}] (${id}) has empty searchText`);
    }
    if (showdownName && id !== toCalcId(showdownName)) {
      summary.idMismatchWithShowdownName += 1;
      summary.examples.idMismatchWithShowdownName.push(`${id} -> ${showdownName}`);
    }

    const ids = optionIds.get(id) ?? [];
    ids.push(index);
    optionIds.set(id, ids);

    const names = optionShowdownNames.get(showdownName) ?? [];
    names.push(index);
    optionShowdownNames.set(showdownName, names);

    const normalizedLabel = normalizeSearchText(label);
    if (normalizedLabel) {
      const labels = normalizedLabels.get(normalizedLabel) ?? [];
      labels.push({ id, label, index });
      normalizedLabels.set(normalizedLabel, labels);
    }

    for (const token of searchText.split(/\s+/).filter(Boolean)) {
      const normalizedToken = normalizeSearchText(token);
      if (!normalizedToken) {
        continue;
      }
      const tokens = normalizedSearchTokens.get(normalizedToken) ?? [];
      tokens.push({ id, token, index });
      normalizedSearchTokens.set(normalizedToken, tokens);
    }

    const catalogEntryById = catalog.byId.get(id);
    const catalogEntryByName = catalog.byShowdownName.get(showdownName);

    if (catalogEntryById) {
      summary.matchedById += 1;
      coveredCatalogIds.add(catalogEntryById.id);
      if (catalogEntryById.showdownName !== showdownName) {
        addError(
          optionFileName,
          `entry ${id} showdownName is ${showdownName}, catalog has ${catalogEntryById.showdownName}`,
        );
      }
    } else if (catalogEntryByName) {
      summary.matchedByShowdownNameOnly += 1;
      coveredCatalogIds.add(catalogEntryByName.id);
      addWarning(
        optionFileName,
        `entry ${id} matched catalog by showdownName ${showdownName}, but catalog id is ${catalogEntryByName.id}`,
      );
    } else {
      summary.missingFromCatalog += 1;
      increment(summary.missingFromCatalogByStatus, sourceStatus);
      summary.examples.missingFromCatalog.push(`${id} (${showdownName}; ${sourceStatus})`);

      if (sourceStatus === "supported") {
        addWarning(optionFileName, `supported entry ${id} (${showdownName}) is not in calc catalog`);
      }
    }
  }

  for (const [id, indexes] of optionIds.entries()) {
    if (indexes.length > 1) {
      summary.duplicateIds += indexes.length;
      summary.examples.duplicateIds.push(`${id} @ ${indexes.join(",")}`);
      addError(optionFileName, `duplicate id ${JSON.stringify(id)} at indexes ${indexes.join(", ")}`);
    }
  }

  for (const [showdownName, indexes] of optionShowdownNames.entries()) {
    if (showdownName && indexes.length > 1) {
      summary.duplicateShowdownNames += indexes.length;
      summary.examples.duplicateShowdownNames.push(`${showdownName} @ ${indexes.join(",")}`);
      addError(
        optionFileName,
        `duplicate showdownName ${JSON.stringify(showdownName)} at indexes ${indexes.join(", ")}`,
      );
    }
  }

  for (const [label, entries] of normalizedLabels.entries()) {
    const uniqueIds = new Set(entries.map((entry) => entry.id));
    if (uniqueIds.size > 1) {
      summary.duplicateNormalizedLabels += 1;
      summary.examples.duplicateNormalizedLabels.push(formatDuplicateExample(label, entries));
    }
  }

  for (const [token, entries] of normalizedSearchTokens.entries()) {
    const uniqueIds = new Set(entries.map((entry) => entry.id));
    if (uniqueIds.size > 1) {
      summary.duplicateNormalizedSearchTokens += 1;
      summary.examples.duplicateNormalizedSearchTokens.push(formatDuplicateExample(token, entries));
    }
  }

  for (const catalogEntry of catalogPayload.entries) {
    if (!isRecord(catalogEntry) || typeof catalogEntry.id !== "string") {
      continue;
    }
    if (!coveredCatalogIds.has(catalogEntry.id)) {
      summary.catalogMissingJaMapping += 1;
      summary.examples.catalogMissingJaMapping.push(`${catalogEntry.id} (${catalogEntry.showdownName})`);
    }
  }

  for (const key of Object.keys(summary.examples)) {
    summary.examples[key] = sample(summary.examples[key]);
  }

  return summary;
};

const overlayTargets = [
  {
    fileName: "ja-aliases.json",
    expectedKind: "ja-alias-overrides",
    validateEntry: (entry, index, fileName) => {
      if (!Array.isArray(entry.aliasesJa)) {
        addError(fileName, `entries[${index}].aliasesJa must be an array`);
      } else if (entry.aliasesJa.some((alias) => typeof alias !== "string" || alias.trim().length === 0)) {
        addError(fileName, `entries[${index}].aliasesJa must contain only non-empty strings`);
      }
    },
  },
  {
    fileName: "ja-label-overrides.json",
    expectedKind: "ja-label-overrides",
    validateEntry: (entry, index, fileName) => {
      if (typeof entry.displayNameJa !== "string" || entry.displayNameJa.trim().length === 0) {
        addError(fileName, `entries[${index}].displayNameJa must be a non-empty string`);
      }
    },
  },
];

const validateOverlay = async (target, catalogByKind) => {
  const payload = await readJson(resolve(overridesDir, target.fileName));
  const hasEntries = validatePayloadShape(target.fileName, payload, target.expectedKind);
  const summary = {
    fileName: target.fileName,
    entries: hasEntries ? payload.entries.length : 0,
    missingCatalogRefs: 0,
    sourceStatus: createCounter(),
    examples: {
      missingCatalogRefs: [],
    },
  };

  if (!hasEntries) {
    return summary;
  }

  const seenKeys = new Set();
  for (const [index, entry] of payload.entries.entries()) {
    if (!isRecord(entry)) {
      addError(target.fileName, `entries[${index}] must be an object`);
      continue;
    }
    if (typeof entry.kind !== "string" || !catalogByKind.has(entry.kind)) {
      addError(target.fileName, `entries[${index}].kind must be one of ${mappingTargets.map(({ kind }) => kind).join(", ")}`);
      continue;
    }
    if (typeof entry.id !== "string" || entry.id.length === 0) {
      addError(target.fileName, `entries[${index}].id must be a non-empty string`);
      continue;
    }

    const key = `${entry.kind}:${entry.id}`;
    if (seenKeys.has(key)) {
      addError(target.fileName, `duplicate override key ${key}`);
    }
    seenKeys.add(key);

    const sourceStatus = entry.sourceStatus ?? "supported";
    increment(summary.sourceStatus, sourceStatus);
    if (!sourceStatusValues.includes(sourceStatus)) {
      addError(target.fileName, `entries[${index}] has unknown sourceStatus ${JSON.stringify(sourceStatus)}`);
    }

    if (!catalogByKind.get(entry.kind).has(entry.id)) {
      summary.missingCatalogRefs += 1;
      summary.examples.missingCatalogRefs.push(key);
      addWarning(target.fileName, `override ${key} does not reference a calc catalog id`);
    }

    target.validateEntry(entry, index, target.fileName);
  }

  summary.examples.missingCatalogRefs = sample(summary.examples.missingCatalogRefs);
  return summary;
};

const summaries = [];
const catalogByKind = new Map();

for (const target of mappingTargets) {
  const optionsPayload = await readJson(resolve(generatedDir, target.optionFileName));
  const catalogPayload = await readJson(resolve(generatedDir, target.catalogFileName));

  const optionsShapeOk = validatePayloadShape(
    target.optionFileName,
    optionsPayload,
    `${target.kind}-options`,
  );
  const catalogShapeOk = validatePayloadShape(target.catalogFileName, catalogPayload, target.kind);

  if (!optionsShapeOk || !catalogShapeOk) {
    continue;
  }

  catalogByKind.set(
    target.kind,
    new Set(catalogPayload.entries.filter(isRecord).map((entry) => entry.id)),
  );

  summaries.push(validateOptionEntries(target, optionsPayload, catalogPayload));
}

const overlaySummaries = [];
for (const target of overlayTargets) {
  overlaySummaries.push(await validateOverlay(target, catalogByKind));
}

console.log("ja mapping validation summary:");
for (const summary of summaries) {
  console.log(
    `- ${summary.kind}: options=${summary.options}, catalog=${summary.catalog}, matchedById=${summary.matchedById}, matchedByShowdownNameOnly=${summary.matchedByShowdownNameOnly}, missingFromCatalog=${summary.missingFromCatalog}, catalogMissingJaMapping=${summary.catalogMissingJaMapping}`,
  );
  console.log(
    `  duplicates=id:${summary.duplicateIds}, showdownName:${summary.duplicateShowdownNames}, normalizedLabel:${summary.duplicateNormalizedLabels}, searchToken:${summary.duplicateNormalizedSearchTokens}`,
  );
  console.log(`  sourceStatus=${JSON.stringify(summary.sourceStatus)}`);
  if (Object.keys(summary.fallbackReasons).length > 0) {
    console.log(`  fallbackReasons=${JSON.stringify(summary.fallbackReasons)}`);
  }
  console.log(`  examples=${JSON.stringify(summary.examples)}`);
}

console.log("\nmanual overlay summary:");
for (const summary of overlaySummaries) {
  console.log(
    `- ${summary.fileName}: entries=${summary.entries}, missingCatalogRefs=${summary.missingCatalogRefs}, sourceStatus=${JSON.stringify(summary.sourceStatus)}`,
  );
  console.log(`  examples=${JSON.stringify(summary.examples)}`);
}

if (warnings.length > 0) {
  console.warn(`\nja mapping validation warnings (${warnings.length}):`);
  for (const warning of sample(warnings, 40)) {
    console.warn(`- ${warning}`);
  }
  if (warnings.length > 40) {
    console.warn(`- ... ${warnings.length - 40} more warning(s)`);
  }
}

if (errors.length > 0) {
  console.error(`\nja mapping validation failed with ${errors.length} issue(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("\nja mapping validation passed");
