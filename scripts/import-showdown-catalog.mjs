import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

// Read only literal name/form metadata. Never execute downloaded Showdown code.
const root = new URL("../", import.meta.url);
const lock = JSON.parse(await readFile(new URL("scripts/data/showdown-source.lock.json", root), "utf8"));
const sourceDir = process.argv[2];
assert(sourceDir, "Usage: node scripts/import-showdown-catalog.mjs <Showdown source directory> [--check]");
const sources = {};
for (const [path, sha256] of Object.entries(lock.files)) {
  const bytes = await readFile(resolve(sourceDir, path));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), sha256, `${path}: pinned source hash mismatch`);
  sources[path] = bytes.toString("utf8");
}
const literal = (node) => {
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  throw new Error(`Expected literal metadata: ${node.getText().slice(0, 80)}`);
};
const table = (path, name, fields) => {
  const source = ts.createSourceFile(path, sources[path], ts.ScriptTarget.Latest, true);
  assert.equal(source.parseDiagnostics.length, 0, `${path}: invalid TypeScript`);
  const declaration = source.statements.flatMap((s) => ts.isVariableStatement(s) ? [...s.declarationList.declarations] : [])
    .find((d) => d.name.getText(source) === name);
  assert(declaration && ts.isObjectLiteralExpression(declaration.initializer), `${name}: missing table`);
  return Object.fromEntries(declaration.initializer.properties.map((property) => {
    assert(ts.isPropertyAssignment(property));
    const key = property.name.text;
    if (!fields) return [key, literal(property.initializer)];
    assert(ts.isObjectLiteralExpression(property.initializer));
    return [key, Object.fromEntries(property.initializer.properties
      .filter((p) => ts.isPropertyAssignment(p) && fields.includes(p.name.text))
      .map((p) => [p.name.text, literal(p.initializer)]))];
  }));
};
const pokemon = table("data/pokedex.ts", "Pokedex", ["name", "baseSpecies", "baseForme", "forme", "otherFormes", "cosmeticFormes", "formeOrder", "isCosmeticForme"]);
const abilities = table("data/abilities.ts", "Abilities", ["name"]);
const types = table("data/typechart.ts", "TypeChart", []);
const aliases = table("data/aliases.ts", "Aliases");
const toID = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
// Older sources may declare a cosmetic name only on the base entry.
for (const entry of Object.values(pokemon)) {
  for (const name of entry.cosmeticFormes ?? []) {
    const id = toID(name);
    pokemon[id] ??= { name, baseSpecies: entry.name, forme: name.slice(entry.name.length + 1), isCosmeticForme: true };
  }
}
const entries = [
  ...Object.entries(pokemon).map(([id, entry]) => ({ kind: "pokemon", showdownId: id, showdownName: entry.name, ...Object.fromEntries(Object.entries(entry).filter(([key]) => key !== "name")) })),
  ...Object.entries(abilities).map(([id, entry]) => ({ kind: "ability", showdownId: id, showdownName: entry.name })),
  ...Object.keys(types).map((id) => ({ kind: "type", showdownId: id, showdownName: id[0].toUpperCase() + id.slice(1) })),
].sort((a, b) => `${a.kind}:${a.showdownId}` < `${b.kind}:${b.showdownId}` ? -1 : 1);
for (const entry of entries) assert.equal(toID(entry.showdownName), entry.showdownId, `Unexpected Showdown identity: ${entry.showdownName}`);
const payload = {
  schemaVersion: 1, dataVersion: `showdown-${lock.commit}`, source: lock,
  generatedBy: "scripts/import-showdown-catalog.mjs", kind: "showdown-name-catalog",
  entries,
  // Audit evidence only; runtime accepts a small explicitly reviewed subset.
  aliases: Object.fromEntries(Object.entries(aliases).filter(([, name]) => entries.some((entry) => entry.showdownId === toID(name)))),
  summary: Object.fromEntries(["pokemon", "ability", "type"].map((kind) => [kind, entries.filter((e) => e.kind === kind).length])),
};
const output = new URL("src/data/generated/showdown-catalog.gen.json", root);
const text = JSON.stringify(payload, null, 2) + "\n";
if (process.argv.includes("--check")) assert.equal((await readFile(output, "utf8")).replace(/\r\n/g, "\n"), text, "Showdown snapshot is stale");
else await writeFile(output, text);
console.log(JSON.stringify(payload.summary));
