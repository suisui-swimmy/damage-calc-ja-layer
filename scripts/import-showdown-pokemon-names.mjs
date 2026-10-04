import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pokemonNameOverrides, projectSourceRow } from "./lib/showdown-pokemon-names.mjs";

// Optional source verification/reimport. Ordinary generation uses the checked-in subset.
const args = process.argv.slice(2);
assert(args.length >= 1 && args.length <= 2 && (args.length === 1 || args[1] === "--check"),
  "Usage: node scripts/import-showdown-pokemon-names.mjs <POKEMON_ALL.json> [--check]");
const root = new URL("../", import.meta.url);
const output = new URL("src/data/overrides/showdown-pokemon-names.json", root);
const approved = JSON.parse(await readFile(output, "utf8"));
const catalog = JSON.parse(await readFile(new URL("src/data/generated/showdown-catalog.gen.json", root), "utf8"));
const rows = JSON.parse(await readFile(args[0], "utf8"));
assert.equal(createHash("sha256").update(JSON.stringify(rows)).digest("hex"), approved.source.jsonContentSha256,
  "Source snapshot changed; review it before changing the pin");
const rebuilt = { ...approved, entries: approved.entries.map((entry) => {
  const byId = rows.filter((row) => row.pkmn_id_name === entry.showdownId);
  const byName = rows.filter((row) => row.pkmn_name?.normalize("NFC") === entry.showdownName.normalize("NFC"));
  assert.deepEqual(byId, byName, `Source name/ID conflict: ${entry.showdownId}`);
  assert(byId.length, `Source identity missing: ${entry.showdownId}`);
  return { ...entry, sourceRows: byId.map(projectSourceRow) };
}) };
pokemonNameOverrides(rebuilt, catalog);
const text = JSON.stringify(rebuilt, null, 2) + "\n";
if (args[1] === "--check") assert.equal((await readFile(output, "utf8")).replace(/\r\n/g, "\n"), text, "Imported subset is stale");
else await writeFile(output, text);
console.log(`Verified ${rebuilt.entries.length} approved Showdown names against the pinned source snapshot`);
