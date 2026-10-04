import assert from "node:assert/strict";

export const sourceFields = ["pokeapi_form_id", "pokeapi_form_id_name", "pkmn_id_name", "pkmn_name", "pokeapi_species_name_ja", "pokeapi_form_name_ja"];
export const projectSourceRow = (row) => Object.fromEntries(sourceFields.map((field) => [field, row[field]]));

/** Only approved identities and explicit label recipes; never strip form suffixes. */
export function pokemonNameOverrides(payload, catalog) {
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.kind, "showdown-pokemon-name-imports");
  assert.equal(payload.showdownCommit, catalog.source.commit, "Re-review imported names when changing Showdown");
  assert.match(payload.source.jsonContentSha256, /^[a-f0-9]{64}$/);
  assert(payload.source.repository && payload.source.approvedOn, "Missing import provenance");
  const known = new Map(catalog.entries.filter((entry) => entry.kind === "pokemon").map((entry) => [entry.showdownId, entry]));
  const ids = new Set();
  return payload.entries.map((entry) => {
    assert(!ids.has(entry.showdownId), `Duplicate imported ID: ${entry.showdownId}`);
    ids.add(entry.showdownId);
    const canonical = known.get(entry.showdownId);
    assert(canonical, `Unknown imported ID: ${entry.showdownId}`);
    assert.equal(entry.showdownName, canonical.showdownName);
    assert(["species-and-form", "species-only", "form-only"].includes(entry.composition), "Unknown label recipe");
    assert(entry.sourceRows.length > 0, `Missing source rows: ${entry.showdownId}`);
    const forms = new Set();
    for (const row of entry.sourceRows) {
      assert.deepEqual(Object.keys(row).sort(), [...sourceFields].sort(), "Unexpected imported fields");
      assert(Number.isInteger(row.pokeapi_form_id) && row.pokeapi_form_id > 0 && row.pokeapi_form_id_name);
      assert(!forms.has(row.pokeapi_form_id), `Duplicate source form: ${entry.showdownId}`);
      forms.add(row.pokeapi_form_id);
      assert.equal(row.pkmn_id_name, entry.showdownId);
      assert.equal(row.pkmn_name.normalize("NFC"), entry.showdownName.normalize("NFC"));
      assert(row.pokeapi_species_name_ja);
      let label;
      if (entry.composition === "species-only") {
        assert.equal(row.pokeapi_form_name_ja, null, "Species-only recipe would discard a form name");
        assert(!canonical.forme && !canonical.baseForme, "Species-only recipe would erase a named form");
        label = row.pokeapi_species_name_ja;
      } else {
        assert(row.pokeapi_form_name_ja, "Missing Japanese form name");
        if (entry.composition === "form-only") {
          assert(row.pokeapi_form_name_ja.includes(row.pokeapi_species_name_ja), "Form-only label must include the species name");
          label = row.pokeapi_form_name_ja;
        } else {
          label = `${row.pokeapi_species_name_ja} ${row.pokeapi_form_name_ja}`;
        }
      }
      // Every row must agree; do not arbitrarily choose the first of multiple matches.
      assert.equal(entry.displayNameJa, label, `Source recipe mismatch: ${entry.showdownId}`);
    }
    return { kind: "pokemon", showdownId: entry.showdownId, showdownName: entry.showdownName,
      displayNameJa: entry.displayNameJa, sources: [payload.source.repository] };
  });
}
