import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { Generations, toID } from "@smogon/calc";

const require = createRequire(import.meta.url);
const calcPackage = require("@smogon/calc/package.json");

const SCHEMA_VERSION = 1;
const GENERATION = 9;
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const generatedDir = resolve(projectRoot, "src/data/generated");
const gen = Generations.get(GENERATION);

const catalogTargets = [
  { kind: "pokemon", fileName: "calc-species.gen.json", source: () => Array.from(gen.species) },
  { kind: "move", fileName: "calc-moves.gen.json", source: () => Array.from(gen.moves) },
  { kind: "item", fileName: "calc-items.gen.json", source: () => Array.from(gen.items) },
  { kind: "ability", fileName: "calc-abilities.gen.json", source: () => Array.from(gen.abilities) },
  { kind: "nature", fileName: "calc-natures.gen.json", source: () => Array.from(gen.natures) },
  { kind: "type", fileName: "calc-types.gen.json", source: () => Array.from(gen.types) },
];

const errors = [];

const addError = (fileName, message) => {
  errors.push(`${fileName}: ${message}`);
};

const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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
  } else {
    if (payload.source.packageName !== calcPackage.name) {
      addError(fileName, `source.packageName must be ${calcPackage.name}`);
    }
    if (payload.source.packageVersion !== calcPackage.version) {
      addError(fileName, `source.packageVersion must be ${calcPackage.version}`);
    }
    if (payload.source.generation !== GENERATION) {
      addError(fileName, `source.generation must be ${GENERATION}`);
    }
  }
  if (typeof payload.generatedBy !== "string" || payload.generatedBy.length === 0) {
    addError(fileName, "generatedBy must be a non-empty string");
  }
  if (payload.kind !== expectedKind) {
    addError(fileName, `kind must be ${expectedKind}`);
  }
  if (!Array.isArray(payload.entries)) {
    addError(fileName, "entries must be an array");
  }
  if (!isRecord(payload.summary)) {
    addError(fileName, "summary must be an object");
  }

  return Array.isArray(payload.entries);
};

const validateEntries = (fileName, payload, expectedKind, sourceEntries) => {
  const seenIds = new Set();
  const expectedById = new Map(
    sourceEntries.map((entry) => [toID(entry.name), entry.name]),
  );

  for (const [index, entry] of payload.entries.entries()) {
    if (!isRecord(entry)) {
      addError(fileName, `entries[${index}] must be an object`);
      continue;
    }

    if (typeof entry.id !== "string") {
      addError(fileName, `entries[${index}].id must be a string`);
    }
    if (entry.kind !== expectedKind) {
      addError(fileName, `entries[${index}].kind must be ${expectedKind}`);
    }
    if (typeof entry.showdownName !== "string" || entry.showdownName.length === 0) {
      addError(fileName, `entries[${index}].showdownName must be a non-empty string`);
    }

    if (typeof entry.id === "string" && typeof entry.showdownName === "string") {
      const expectedId = toID(entry.showdownName);
      if (entry.id !== expectedId) {
        addError(
          fileName,
          `entries[${index}].id (${entry.id}) must match toID(showdownName) (${expectedId})`,
        );
      }
      if (seenIds.has(entry.id)) {
        addError(fileName, `duplicate id ${JSON.stringify(entry.id)}`);
      }
      seenIds.add(entry.id);

      const currentName = expectedById.get(entry.id);
      if (currentName === undefined) {
        addError(fileName, `id ${JSON.stringify(entry.id)} is not in current @smogon/calc Gen9`);
      } else if (currentName !== entry.showdownName) {
        addError(
          fileName,
          `id ${JSON.stringify(entry.id)} showdownName is ${entry.showdownName}, expected ${currentName}`,
        );
      }
    }
  }

  for (const [expectedId, expectedName] of expectedById.entries()) {
    if (!seenIds.has(expectedId)) {
      addError(fileName, `missing current @smogon/calc Gen9 id ${JSON.stringify(expectedId)} (${expectedName})`);
    }
  }

  if (isRecord(payload.summary)) {
    if (payload.summary.entryCount !== payload.entries.length) {
      addError(fileName, "summary.entryCount must match entries.length");
    }
    const emptyIdCount = payload.entries.filter((entry) => isRecord(entry) && entry.id === "").length;
    if (payload.summary.emptyIdCount !== emptyIdCount) {
      addError(fileName, "summary.emptyIdCount must match entries with empty id");
    }
  }
};

for (const target of catalogTargets) {
  const fileName = target.fileName;
  const filePath = resolve(generatedDir, fileName);
  const payload = JSON.parse(await readFile(filePath, "utf8"));
  const hasEntries = validatePayloadShape(fileName, payload, target.kind);

  if (hasEntries) {
    validateEntries(fileName, payload, target.kind, target.source());
    console.log(`validated ${fileName}: ${payload.entries.length} entries`);
  }
}

if (errors.length > 0) {
  console.error(`\ncalc catalog validation failed with ${errors.length} issue(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("\ncalc catalog validation passed");
