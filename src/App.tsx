import { calculateDamage, getSmogonCalcVersion } from "./calc/smogonAdapter";
import { formatDamageResultJa } from "./formatters/jaResultFormatter";
import { resolveEntity } from "./localization/resolver";

const smokeInputs = [
  ["pokemon", "ピカチュウ"],
  ["move", "10まんボルト"],
  ["item", "こだわりメガネ"],
  ["nature", "ひかえめ"],
  ["type", "でんき"],
] as const;

const smokeResult = calculateDamage({
  attacker: {
    name: "Pikachu",
    level: 50,
    nature: "Modest",
    item: "Choice Specs",
    evs: { spa: 252 },
  },
  defender: {
    name: "Squirtle",
    level: 50,
    evs: { hp: 252 },
  },
  move: {
    name: "Thunderbolt",
  },
});

export const App = () => (
  <main className="app-shell">
    <section className="hero">
      <p className="eyebrow">Milestone 0</p>
      <h1>Damage Calc JA Layer</h1>
      <p>
        日本語入力を Smogon / Showdown canonical name に解決し、
        @smogon/calc の結果を日本語表示へ戻すための検証土台です。
      </p>
    </section>

    <section className="panel">
      <h2>Resolver Smoke</h2>
      <div className="result-grid">
        {smokeInputs.map(([kind, input]) => {
          const result = resolveEntity(kind, input);
          return (
            <div className="result-row" key={`${kind}:${input}`}>
              <span>{kind}</span>
              <strong>{input}</strong>
              <code>{result.canonicalName ?? result.status}</code>
            </div>
          );
        })}
      </div>
    </section>

    <section className="panel">
      <h2>Calc Smoke</h2>
      <p className="version">@smogon/calc {getSmogonCalcVersion()}</p>
      <p>{formatDamageResultJa(smokeResult).summaryText}</p>
      <code>{smokeResult.description}</code>
    </section>
  </main>
);
