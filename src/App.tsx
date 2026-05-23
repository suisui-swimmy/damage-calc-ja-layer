import { useMemo, useState } from "react";
import type { EntityKind, LocalizedOptionPayload } from "./data/optionTypes";
import abilityOptions from "./data/generated/ability-options.gen.json";
import itemOptions from "./data/generated/item-options.gen.json";
import moveOptions from "./data/generated/move-options.gen.json";
import natureOptions from "./data/generated/nature-options.gen.json";
import pokemonOptions from "./data/generated/pokemon-options.gen.json";
import typeOptions from "./data/generated/type-options.gen.json";
import { calculateDamage, getSmogonCalcVersion } from "./calc/smogonAdapter";
import { formatDamageResultJa } from "./formatters/jaResultFormatter";
import { getOptionDisplayNameJa } from "./localization/displayNameRules";
import { resolveEntity, type ResolveCandidate, type ResolveResult } from "./localization/resolver";

type LedgerStatus = "exact" | "alias" | "source" | "needs-confirmation";
type StatusFilter = LedgerStatus | "all" | "needs-confirmation";

interface LedgerRow {
  id: string;
  kind: EntityKind;
  labelJa: string;
  inputJa: string;
  canonicalName: string;
  source: string;
  aliases: string[];
  status: LedgerStatus;
  artwork?: string;
}

interface ArtworkImageProps {
  artwork: string;
  fallbackClassName: string;
  label: string;
  size: number;
}

const assetPath = (path: string) =>
  `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

const ArtworkImage = ({ artwork, fallbackClassName, label, size }: ArtworkImageProps) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className={fallbackClassName}>{label.slice(0, 1)}</span>;
  }

  return (
    <img
      src={assetPath(artwork)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
};

const pokemonOptionPayload = pokemonOptions as LocalizedOptionPayload<"pokemon-options">;
const optionPayloadByKind: Record<EntityKind, LocalizedOptionPayload> = {
  pokemon: pokemonOptionPayload,
  move: moveOptions as LocalizedOptionPayload<"move-options">,
  item: itemOptions as LocalizedOptionPayload<"item-options">,
  ability: abilityOptions as LocalizedOptionPayload<"ability-options">,
  nature: natureOptions as LocalizedOptionPayload<"nature-options">,
  type: typeOptions as LocalizedOptionPayload<"type-options">,
};

const pokemonOptionById = new Map(pokemonOptionPayload.entries.map((entry) => [entry.id, entry]));
const pokemonArtworkByCanonicalName = new Map(
  pokemonOptionPayload.entries.map((entry) => [entry.showdownName, entry.artwork]),
);

const sourceStatusToLedgerStatus = (sourceStatus?: string): LedgerStatus => {
  if (sourceStatus === "needs-confirmation") {
    return "needs-confirmation";
  }
  if (sourceStatus === "adapter-temporary" || sourceStatus === "unsupported-temporary") {
    return "source";
  }
  return "exact";
};

const optionRowsByKind = Object.fromEntries(
  Object.entries(optionPayloadByKind).map(([kind, payload]) => [
    kind,
    payload.entries.map((entry): LedgerRow => ({
      id: `${kind}:${entry.id}`,
      kind: kind as EntityKind,
      labelJa: getOptionDisplayNameJa(kind as EntityKind, entry),
      inputJa: getOptionDisplayNameJa(kind as EntityKind, entry),
      canonicalName: entry.showdownName,
      source: payload.generatedBy,
      aliases: [entry.showdownName, entry.id],
      status: sourceStatusToLedgerStatus(entry.sourceStatus ?? entry.fallback?.nameSourceStatus),
      artwork: kind === "pokemon" ? entry.artwork : undefined,
    })),
  ]),
) as Record<EntityKind, LedgerRow[]>;

const ledgerRows = Object.values(optionRowsByKind).flat();

const smokeResult = calculateDamage({
  attacker: {
    canonicalName: "Pikachu",
    level: 50,
    ability: "Static",
    nature: "Modest",
    item: "Choice Specs",
    evs: { spa: 252 },
  },
  defender: {
    canonicalName: "Squirtle",
    level: 50,
    evs: { hp: 252 },
  },
  move: {
    canonicalName: "Thunderbolt",
  },
});

const formattedResult = formatDamageResultJa(smokeResult);

const kindLabels: Record<EntityKind, string> = {
  pokemon: "Pokemon",
  move: "Move",
  item: "Item",
  ability: "Ability",
  nature: "Nature",
  type: "Type",
};

const statusLabels: Record<LedgerStatus, string> = {
  exact: "exact",
  alias: "alias",
  source: "source",
  "needs-confirmation": "needs-confirmation",
};

const attackerArtwork = pokemonArtworkByCanonicalName.get(
  formattedResult.attacker.name.canonicalName,
);
const defenderArtwork = pokemonArtworkByCanonicalName.get(
  formattedResult.defender.name.canonicalName,
);

const statusFilters: StatusFilter[] = ["all", "exact", "alias", "source", "needs-confirmation"];

const matchesStatusFilter = (row: LedgerRow, filter: StatusFilter) =>
  filter === "all" || row.status === filter;

const firstMatchingRow = (kind: EntityKind, filter: StatusFilter) =>
  ledgerRows.find((row) => row.kind === kind && matchesStatusFilter(row, filter)) ??
  ledgerRows.find((row) => row.kind === kind) ??
  ledgerRows[0];

const candidateStatus = (candidate: ResolveCandidate): LedgerStatus => {
  if (candidate.sourceStatus === "needs-confirmation") {
    return "needs-confirmation";
  }
  if (candidate.matchedBy === "manualAlias" || candidate.matchedBy === "searchText") {
    return "alias";
  }
  if (candidate.matchedBy === "fuzzy") {
    return "source";
  }
  return "exact";
};

const rowFromCandidate = (
  kind: EntityKind,
  input: string,
  candidate: ResolveCandidate,
  index: number,
): LedgerRow => {
  const option = kind === "pokemon" ? pokemonOptionById.get(candidate.calcId) : undefined;

  return {
    id: `candidate:${kind}:${candidate.calcId}:${index}`,
    kind,
    labelJa: candidate.displayNameJa,
    inputJa: input,
    canonicalName: candidate.canonicalName,
    source: candidate.reason,
    aliases: [candidate.matchText, candidate.canonicalName, candidate.calcId],
    status: candidateStatus(candidate),
    artwork: option?.artwork,
  };
};

const rowsFromResolveResult = (
  kind: EntityKind,
  input: string,
  result: ResolveResult,
): LedgerRow[] =>
  result.candidates?.map((candidate, index) => rowFromCandidate(kind, input, candidate, index)) ??
  [];

export const App = () => {
  const [activeKind, setActiveKind] = useState<EntityKind>("pokemon");
  const [activeStatusFilter, setActiveStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("ピカチュウ");
  const [allowFuzzy, setAllowFuzzy] = useState(true);
  const [selectedRowId, setSelectedRowId] = useState(firstMatchingRow("pokemon", "all").id);
  const normalizedQuery = query.trim();
  const resolveResult = useMemo(
    () =>
      normalizedQuery
        ? resolveEntity(activeKind, normalizedQuery, { allowFuzzy })
        : undefined,
    [activeKind, allowFuzzy, normalizedQuery],
  );
  const candidateRows = useMemo(
    () =>
      resolveResult
        ? rowsFromResolveResult(activeKind, normalizedQuery, resolveResult)
        : [],
    [activeKind, normalizedQuery, resolveResult],
  );

  const visibleRows = useMemo(
    () => {
      const sourceRows = normalizedQuery ? candidateRows : optionRowsByKind[activeKind];
      return sourceRows.filter((row) => matchesStatusFilter(row, activeStatusFilter));
    },
    [activeKind, activeStatusFilter, candidateRows, normalizedQuery],
  );

  const selectedRow = visibleRows.find((row) => row.id === selectedRowId) ?? visibleRows[0];
  const selectedTrace = selectedRow
    ? resolveEntity(selectedRow.kind, selectedRow.inputJa, { allowFuzzy })
    : resolveResult;
  const statusSummary = resolveResult
    ? `${resolveResult.status} / ${resolveResult.candidates?.length ?? 0} candidates`
    : `${optionRowsByKind[activeKind].length} entries`;

  const selectKind = (kind: EntityKind) => {
    setActiveKind(kind);
    setSelectedRowId("");
  };

  const selectStatusFilter = (filter: StatusFilter) => {
    setActiveStatusFilter(filter);
    setSelectedRowId("");
  };

  const updateQuery = (value: string) => {
    setQuery(value);
    setSelectedRowId("");
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Milestone 6 UI Preview</p>
          <h1>日英対応一覧</h1>
        </div>
        <div className="version-stack" aria-label="version info">
          <span>@smogon/calc {getSmogonCalcVersion()}</span>
          <span>data calc-0.11.0-gen9</span>
        </div>
      </header>

      <section className="resolver-panel" aria-labelledby="resolver-title">
        <div>
          <h2 id="resolver-title">resolver input</h2>
          <p>{kindLabels[activeKind]} / {statusSummary}</p>
        </div>
        <div className="resolver-controls">
          <label className="query-field">
            <span>input</span>
            <input
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="ピカチュウ / 10万ボルト / Choice Specs"
              value={query}
            />
          </label>
          <label className="toggle-field">
            <input
              checked={allowFuzzy}
              onChange={(event) => {
                setAllowFuzzy(event.target.checked);
                setSelectedRowId("");
              }}
              type="checkbox"
            />
            <span>fuzzy</span>
          </label>
          <button className="clear-button" onClick={() => updateQuery("")} type="button">
            clear
          </button>
        </div>
      </section>

      <section className="workspace" aria-label="Japanese English mapping workspace">
        <nav className="entity-rail" aria-label="entity categories">
          {Object.entries(kindLabels).map(([kind, label]) => {
            const entityKind = kind as EntityKind;
            const count = ledgerRows.filter((row) => row.kind === entityKind).length;
            return (
              <button
                aria-pressed={entityKind === activeKind}
                className={entityKind === activeKind ? "rail-item active" : "rail-item"}
                key={kind}
                onClick={() => selectKind(entityKind)}
                type="button"
              >
                <span>{label}</span>
                <strong>{count}</strong>
              </button>
            );
          })}
        </nav>

        <section className="ledger-panel" aria-labelledby="ledger-title">
          <div className="panel-header">
            <div>
              <h2 id="ledger-title">日英対応</h2>
              <p>{normalizedQuery ? `「${normalizedQuery}」の resolver 候補` : `${kindLabels[activeKind]} の option entries`}</p>
            </div>
            <div className="filter-row" aria-label="status filters">
              {statusFilters.map((filter) => (
                <button
                  aria-pressed={filter === activeStatusFilter}
                  className={filter === activeStatusFilter ? "filter-chip active" : "filter-chip"}
                  key={filter}
                  onClick={() => selectStatusFilter(filter)}
                  type="button"
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="ledger-table" role="table" aria-label="mapping ledger">
            <div className="ledger-head" role="row">
              <span>kind</span>
              <span>日本語名</span>
              <span>canonical</span>
              <span>source</span>
              <span>aliases</span>
            </div>

            {visibleRows.length > 0 ? (
              visibleRows.map((row) => (
                <button
                  className={row.id === selectedRow.id ? "ledger-row selected" : "ledger-row"}
                  key={row.id}
                  onClick={() => setSelectedRowId(row.id)}
                  type="button"
                >
                  <span>
                    <span className={`status-dot ${row.status}`} />
                    {kindLabels[row.kind]}
                  </span>
                  <strong className="ja-cell">
                    {row.artwork ? (
                      <ArtworkImage
                        artwork={row.artwork}
                        fallbackClassName="entity-mark"
                        label={row.labelJa}
                        size={40}
                      />
                    ) : (
                      <span className="entity-mark">{row.labelJa.slice(0, 1)}</span>
                    )}
                    {row.labelJa}
                  </strong>
                  <code>{row.canonicalName}</code>
                  <span className={`source-chip ${row.status}`}>{statusLabels[row.status]}</span>
                  <span className="alias-list">{row.aliases.join(" / ")}</span>
                </button>
              ))
            ) : (
              <div className="empty-state">該当する行がありません</div>
            )}
          </div>
        </section>

        <aside className="trace-panel" aria-labelledby="trace-title">
          <div className="panel-header stacked">
            <div>
              <h2 id="trace-title">resolver trace</h2>
              <p>選択中の行が計算入力へ渡るまでの検証ログ。</p>
            </div>
            <span className={`source-chip ${selectedRow?.status ?? "source"}`}>selected</span>
          </div>

          <div className="trace-card">
            <span>入力</span>
            <strong>{selectedRow?.inputJa ?? normalizedQuery ?? "-"}</strong>
          </div>
          <div className="trace-arrow" aria-hidden="true" />
          <div className="trace-card">
            <span>resolver</span>
            <strong>{selectedTrace?.status ?? "not-found"}</strong>
            <small>{selectedTrace?.candidates?.[0]?.reason ?? "candidate check"}</small>
          </div>
          <div className="trace-arrow" aria-hidden="true" />
          <div className="trace-card">
            <span>canonical</span>
            <code>{selectedTrace?.canonicalName ?? selectedRow?.canonicalName ?? "未決定"}</code>
          </div>
          <div className="trace-arrow" aria-hidden="true" />
          <div className="trace-card">
            <span>formatter</span>
            <strong>{formattedResult.summaryText}</strong>
          </div>

          <div className="raw-source">
            <span>raw source</span>
            <code>{smokeResult.rawDescription}</code>
          </div>
        </aside>
      </section>

      <section className="calc-strip" aria-label="calculation result">
        <div>
          <div className="result-entity">
            {attackerArtwork ? (
              <ArtworkImage
                artwork={attackerArtwork}
                fallbackClassName="result-mark"
                label={formattedResult.attacker.name.displayNameJa}
                size={52}
              />
            ) : (
              <span className="result-mark">
                {formattedResult.attacker.name.displayNameJa.slice(0, 1)}
              </span>
            )}
            <div>
              <span>attacker</span>
              <strong>{formattedResult.attacker.name.displayNameJa}</strong>
              <code>{formattedResult.attacker.name.canonicalName}</code>
            </div>
          </div>
        </div>
        <div>
          <span>move</span>
          <strong>{formattedResult.move.name.displayNameJa}</strong>
          <code>{formattedResult.move.name.canonicalName}</code>
        </div>
        <div>
          <div className="result-entity">
            {defenderArtwork ? (
              <ArtworkImage
                artwork={defenderArtwork}
                fallbackClassName="result-mark"
                label={formattedResult.defender.name.displayNameJa}
                size={52}
              />
            ) : (
              <span className="result-mark">
                {formattedResult.defender.name.displayNameJa.slice(0, 1)}
              </span>
            )}
            <div>
              <span>defender</span>
              <strong>{formattedResult.defender.name.displayNameJa}</strong>
              <code>{formattedResult.defender.name.canonicalName}</code>
            </div>
          </div>
        </div>
        <div className="damage-result">
          <span>formatter result</span>
          <strong>{formattedResult.summaryText}</strong>
        </div>
      </section>
    </main>
  );
};
