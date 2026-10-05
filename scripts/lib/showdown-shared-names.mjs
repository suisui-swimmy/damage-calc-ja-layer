import assert from "node:assert/strict";

/** A shared display name is allowed only for the exact reviewed set of external IDs. */
export function validateSharedDisplayNames(groups, entries, labelOf) {
  const byId = new Map(entries.map((entry) => [`${entry.kind}:${entry.showdownId}`, entry]));
  assert.equal(byId.size, entries.length, "Duplicate external identity");
  const byLabel = new Map();
  for (const entry of entries.filter((entry) => entry.status === "localized")) {
    const key = `${entry.kind}:${labelOf(entry)}`;
    byLabel.set(key, [...(byLabel.get(key) ?? []), entry]);
  }
  const approved = new Set();
  for (const group of groups) {
    assert(["pokemon", "ability", "type", "move", "item", "nature"].includes(group.kind), "Invalid shared-name kind");
    assert(typeof group.displayNameJa === "string" && group.displayNameJa.trim(), "Missing shared name");
    assert(Array.isArray(group.sources) && group.sources.length > 0 &&
      group.sources.every((source) => typeof source === "string" && source.trim()) &&
      typeof group.verifiedOn === "string" && group.verifiedOn.trim(), "Missing shared-name evidence");
    assert(Array.isArray(group.showdownIds) && group.showdownIds.length >= 2 &&
      group.showdownIds.every((id) => typeof id === "string" && id.trim()), "A shared-name group needs at least two IDs");
    assert.equal(new Set(group.showdownIds).size, group.showdownIds.length, "Duplicate shared-name member");
    const key = `${group.kind}:${group.displayNameJa}`;
    assert(!approved.has(key), "Duplicate shared-name group");
    const members = group.showdownIds.map((id) => {
      const entry = byId.get(`${group.kind}:${id}`);
      assert(entry, `Unknown shared-name member: ${id}`);
      assert.equal(entry.status, "localized", `Unlocalized shared-name member: ${id}`);
      assert.equal(labelOf(entry), group.displayNameJa, `Shared name differs: ${id}`);
      return entry;
    });
    // An unreviewed third form must not be silently admitted by matching the same label.
    assert.deepEqual((byLabel.get(key) ?? []).map((entry) => entry.showdownId).sort(), [...group.showdownIds].sort(),
      `Shared-name membership changed: ${key}`);
    assert(members.every((entry) => entry.variantLabelJa === undefined ||
      (typeof entry.variantLabelJa === "string" && entry.variantLabelJa.trim())), "Invalid variant label");
    const qualifiers = members.map((entry) => entry.variantLabelJa ?? "");
    assert.equal(new Set(qualifiers).size, members.length, `Indistinguishable shared-name qualifiers: ${key}`);
    approved.add(key);
  }
  return approved;
}
