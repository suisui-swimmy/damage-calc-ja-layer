import { useMemo, useState } from "react";
import type { EntityKind, LocalizedOptionPayload } from "./data/optionTypes";
import pokemonOptions from "./data/generated/pokemon-options.gen.json";
import { calculateDamage, getSmogonCalcVersion } from "./calc/smogonAdapter";
import { formatDamageResultJa } from "./formatters/jaResultFormatter";
import { resolveEntity } from "./localization/resolver";

type LedgerStatus = "exact" | "alias" | "source";
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

const assetPath = (path: string) =>
  `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

const pokemonOptionPayload = pokemonOptions as LocalizedOptionPayload<"pokemon-options">;
const pokemonOptionById = new Map(pokemonOptionPayload.entries.map((entry) => [entry.id, entry]));
const pokemonArtworkByCanonicalName = new Map(
  pokemonOptionPayload.entries.map((entry) => [entry.showdownName, entry.artwork]),
);

const pokemonShowcaseIds = [
  "pikachu",
  "squirtle",
  "charizard",
  "garchomp",
  "miraidon",
  "ogerponwellspring",
  "terapagosstellar",
  "zygardecomplete",
];

const pokemonLedgerRows = pokemonShowcaseIds.flatMap((id): LedgerRow[] => {
  const option = pokemonOptionById.get(id);

  if (!option) {
    return [];
  }

  return [
    {
      id: `pokemon:${option.id}`,
      kind: "pokemon",
      labelJa: option.label,
      inputJa: option.label,
      canonicalName: option.showdownName,
      source: "pokemon-options artwork",
      aliases: [option.showdownName, option.id],
      status: "exact",
      artwork: option.artwork,
    },
  ];
});

const ledgerRows: LedgerRow[] = [
  ...pokemonLedgerRows,
  {
    id: "move:thunderbolt",
    kind: "move",
    labelJa: "10まんボルト",
    inputJa: "10万ボルト",
    canonicalName: "Thunderbolt",
    source: "manual alias overlay",
    aliases: ["10まんボルト", "10万ボルト", "Thunderbolt"],
    status: "alias",
  },
  {
    id: "item:choicespecs",
    kind: "item",
    labelJa: "こだわりメガネ",
    inputJa: "こだわりメガネ",
    canonicalName: "Choice Specs",
    source: "ChampionCreator option",
    aliases: ["Choice Specs", "choicespecs"],
    status: "exact",
  },
  {
    id: "ability:static",
    kind: "ability",
    labelJa: "せいでんき",
    inputJa: "せいでんき",
    canonicalName: "Static",
    source: "ChampionCreator option",
    aliases: ["Static", "static"],
    status: "exact",
  },
  {
    id: "nature:modest",
    kind: "nature",
    labelJa: "ひかえめ",
    inputJa: "ひかえめ",
    canonicalName: "Modest",
    source: "ChampionCreator option",
    aliases: ["Modest", "とくこう上昇"],
    status: "exact",
  },
  {
    id: "type:electric",
    kind: "type",
    labelJa: "でんき",
    inputJa: "でんき",
    canonicalName: "Electric",
    source: "calc catalog",
    aliases: ["Electric", "electric"],
    status: "source",
  },
];

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
};

const attackerArtwork = pokemonArtworkByCanonicalName.get(
  formattedResult.attacker.name.canonicalName,
);
const defenderArtwork = pokemonArtworkByCanonicalName.get(
  formattedResult.defender.name.canonicalName,
);

const statusFilters: StatusFilter[] = ["all", "exact", "alias", "needs-confirmation"];

const matchesStatusFilter = (row: LedgerRow, filter: StatusFilter) =>
  filter === "all" || row.status === filter;

const firstMatchingRow = (kind: EntityKind, filter: StatusFilter) =>
  ledgerRows.find((row) => row.kind === kind && matchesStatusFilter(row, filter)) ??
  ledgerRows.find((row) => row.kind === kind) ??
  ledgerRows[0];

export const App = () => {
  const [activeKind, setActiveKind] = useState<EntityKind>("pokemon");
  const [activeStatusFilter, setActiveStatusFilter] = useState<StatusFilter>("all");
  const [selectedRowId, setSelectedRowId] = useState(firstMatchingRow("pokemon", "all").id);

  const visibleRows = useMemo(
    () =>
      ledgerRows.filter(
        (row) => row.kind === activeKind && matchesStatusFilter(row, activeStatusFilter),
      ),
    [activeKind, activeStatusFilter],
  );

  const selectedRow =
    visibleRows.find((row) => row.id === selectedRowId) ??
    firstMatchingRow(activeKind, activeStatusFilter);
  const selectedTrace = resolveEntity(selectedRow.kind, selectedRow.inputJa);

  const selectKind = (kind: EntityKind) => {
    const nextSelectedRow = firstMatchingRow(kind, activeStatusFilter);

    setActiveKind(kind);
    setSelectedRowId(nextSelectedRow.id);
  };

  const selectStatusFilter = (filter: StatusFilter) => {
    const nextSelectedRow = firstMatchingRow(activeKind, filter);

    setActiveStatusFilter(filter);
    setSelectedRowId(nextSelectedRow.id);
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
              <p>日本語 UI の入力語と Smogon / Showdown canonical name の対応を確認する画面。</p>
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
                      <img
                        src={assetPath(row.artwork)}
                        alt=""
                        width="40"
                        height="40"
                        loading="lazy"
                        decoding="async"
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
            <span className={`source-chip ${selectedRow.status}`}>selected</span>
          </div>

          <div className="trace-card">
            <span>入力</span>
            <strong>{selectedRow.inputJa}</strong>
          </div>
          <div className="trace-arrow" aria-hidden="true" />
          <div className="trace-card">
            <span>resolver</span>
            <strong>{selectedTrace.status}</strong>
            <small>{selectedTrace.candidates?.[0]?.reason ?? "candidate check"}</small>
          </div>
          <div className="trace-arrow" aria-hidden="true" />
          <div className="trace-card">
            <span>canonical</span>
            <code>{selectedTrace.canonicalName ?? selectedRow.canonicalName}</code>
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
              <img
                src={assetPath(attackerArtwork)}
                alt=""
                width="52"
                height="52"
                loading="lazy"
                decoding="async"
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
              <img
                src={assetPath(defenderArtwork)}
                alt=""
                width="52"
                height="52"
                loading="lazy"
                decoding="async"
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
