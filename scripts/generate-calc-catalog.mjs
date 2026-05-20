import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { Generations, toID } from "@smogon/calc";

const require = createRequire(import.meta.url);
const calcPackage = require("@smogon/calc/package.json");

const SCHEMA_VERSION = 1;
const GENERATION = 9;
const GENERATED_BY = "scripts/generate-calc-catalog.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const generatedDir = resolve(projectRoot, "src/data/generated");
const gen = Generations.get(GENERATION);

const catalogTargets = [
  {
    kind: "pokemon",
    fileName: "calc-species.gen.json",
    entries: () =>
      Array.from(gen.species).map((species) => ({
        id: toID(species.name),
        kind: "pokemon",
        showdownName: species.name,
        types: species.types,
        baseStats: species.baseStats,
        weightkg: species.weightkg,
        ...(species.nfe === undefined ? {} : { nfe: species.nfe }),
        ...(species.gender === undefined ? {} : { gender: species.gender }),
        ...(species.baseSpecies === undefined ? {} : { baseSpecies: species.baseSpecies }),
        ...(species.otherFormes === undefined ? {} : { otherFormes: species.otherFormes }),
        ...(species.abilities === undefined
          ? {}
          : { abilities: Object.values(species.abilities).filter(Boolean) }),
      })),
  },
  {
    kind: "move",
    fileName: "calc-moves.gen.json",
    entries: () =>
      Array.from(gen.moves).map((move) => ({
        id: toID(move.name),
        kind: "move",
        showdownName: move.name,
        type: move.type,
        category: move.category,
        basePower: move.basePower,
        ...(move.priority === undefined ? {} : { priority: move.priority }),
        ...(move.target === undefined ? {} : { target: move.target }),
        ...(move.flags === undefined ? {} : { flags: move.flags }),
        ...(move.multihit === undefined ? {} : { multihit: move.multihit }),
      })),
  },
  {
    kind: "item",
    fileName: "calc-items.gen.json",
    entries: () =>
      Array.from(gen.items).map((item) => ({
        id: toID(item.name),
        kind: "item",
        showdownName: item.name,
        ...(item.isBerry === undefined ? {} : { isBerry: item.isBerry }),
        ...(item.megaStone === undefined ? {} : { megaStone: item.megaStone }),
        ...(item.naturalGift === undefined ? {} : { naturalGift: item.naturalGift }),
      })),
  },
  {
    kind: "ability",
    fileName: "calc-abilities.gen.json",
    entries: () =>
      Array.from(gen.abilities).map((ability) => ({
        id: toID(ability.name),
        kind: "ability",
        showdownName: ability.name,
      })),
  },
  {
    kind: "nature",
    fileName: "calc-natures.gen.json",
    entries: () =>
      Array.from(gen.natures).map((nature) => ({
        id: toID(nature.name),
        kind: "nature",
        showdownName: nature.name,
        ...(nature.plus === undefined ? {} : { plus: nature.plus }),
        ...(nature.minus === undefined ? {} : { minus: nature.minus }),
      })),
  },
  {
    kind: "type",
    fileName: "calc-types.gen.json",
    entries: () =>
      Array.from(gen.types).map((type) => ({
        id: toID(type.name),
        kind: "type",
        showdownName: type.name,
      })),
  },
];

const compareEntries = (a, b) =>
  a.id.localeCompare(b.id, "en") || a.showdownName.localeCompare(b.showdownName, "en");

const buildPayload = (kind, entries) => {
  const sortedEntries = entries.sort(compareEntries);
  const emptyIdCount = sortedEntries.filter((entry) => entry.id === "").length;

  return {
    schemaVersion: SCHEMA_VERSION,
    dataVersion: `${calcPackage.name}@${calcPackage.version}-gen${GENERATION}`,
    source: {
      packageName: calcPackage.name,
      packageVersion: calcPackage.version,
      packageLicense: calcPackage.license,
      generation: GENERATION,
    },
    generatedBy: GENERATED_BY,
    kind,
    entries: sortedEntries,
    summary: {
      entryCount: sortedEntries.length,
      emptyIdCount,
      metadataIsUiHintOnly: true,
    },
  };
};

await mkdir(generatedDir, { recursive: true });

for (const target of catalogTargets) {
  const payload = buildPayload(target.kind, target.entries());
  const outputPath = resolve(generatedDir, target.fileName);
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `generated ${target.fileName}: ${payload.summary.entryCount} ${target.kind} entries`,
  );
}
