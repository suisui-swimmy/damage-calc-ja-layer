# damage-calc-ja-layer

`@smogon/calc` の外側に、日本語入力・日本語表示のレイヤーを作るためのプロジェクト。

Smogon / Showdown 側の計算エンジンは改変せず、次の境界を守る。

```text
日本語 UI / 日本語入力
  -> 日本語名 resolver
  -> Smogon / Showdown canonical name
  -> @smogon/calc
  -> 日本語 formatter
  -> 日本語の計算結果表示
```

## 現在地

Milestone 1 の calc catalog 生成・検証土台を実装済み。

現在できること:

- React + Vite + TypeScript + Vitest で起動・test・build できる
- `@smogon/calc` を導入し、`scripts/inspect-smogon-calc.mjs` で API / version / smoke calculation を確認できる
- `@smogon/calc` Gen9 から Pokemon / Move / Item / Ability / Nature / Type の calc catalog を再生成できる
- calc catalog の schema / 必須キー / id 重複 / 現在の `@smogon/calc` Gen9 との差分を検証できる
- ChampionCreator 由来の生成済み options JSON を `src/data/generated/` にコピー済み
- 日本語入力を canonical name へ解決する resolver の固定ケースをテストできる
- `src/calc/smogonAdapter.ts` 経由で `@smogon/calc` の最小計算ができる
- 最小 formatter で calc 結果を日本語 UI 用構造へ変換できる

## 方針

- 詳細なプロジェクト契約、実装ルール、MVP マイルストーンは [AGENTS.md](AGENTS.md) を参照
- `@smogon/calc` を計算の唯一の正とし、独自のダメージ計算式は実装しない
- `@smogon/calc` 呼び出しは `src/calc/smogonAdapter.ts` に閉じ込める
- 日本語入力の解決は `src/localization/`、日本語表示は `src/formatters/` に分ける
- 作業ログや一時的な調査メモは git 追跡対象にしない

## 初期の確認対象

最初の resolver / formatter MVP では、最低限この対応を固定ケースとして確認する。

| 種別 | 日本語入力 | canonical name |
| --- | --- | --- |
| Pokemon | ピカチュウ | Pikachu |
| Move | 10まんボルト | Thunderbolt |
| Move | きあいだま | Focus Blast |
| Item | こだわりメガネ | Choice Specs |

## 開発コマンド

```bash
npm install
npm run generate:calc-catalog
npm run validate:calc-catalog
npm run inspect:calc
npm test
npm run build
npm run dev
```

GitHub Pages 公開前には、Actions で `npm test` と `npm run build` が通る状態にする。

## 実装済みの主な境界

- `src/localization/normalizeJa.ts`: 日本語・英語入力の検索用正規化
- `src/localization/resolver.ts`: entity kind ごとの日本語入力 -> canonical name 解決
- `src/calc/smogonAdapter.ts`: `@smogon/calc` 呼び出し境界
- `src/formatters/jaResultFormatter.ts`: calc 結果の日本語表示用 formatter
- `src/data/generated/*.gen.json`: ChampionCreator 由来の生成済み options JSON
- `src/data/generated/calc-*.gen.json`: `@smogon/calc` Gen9 由来の canonical catalog

## calc catalog 生成

`@smogon/calc` から canonical name の catalog を再生成する。

```bash
npm run generate:calc-catalog
npm run validate:calc-catalog
```

生成対象:

- `src/data/generated/calc-species.gen.json`
- `src/data/generated/calc-moves.gen.json`
- `src/data/generated/calc-items.gen.json`
- `src/data/generated/calc-abilities.gen.json`
- `src/data/generated/calc-natures.gen.json`
- `src/data/generated/calc-types.gen.json`

各 JSON は `schemaVersion`、`dataVersion`、`source`、`generatedBy`、`kind`、`entries`、`summary` を持つ。
entry の `id` は `toID(showdownName)` 相当、`showdownName` は `@smogon/calc` に渡す canonical name。

Move / Item / Ability / Nature / Type / Pokemon の補助 metadata は UI 表示や検証用のヒントとして持たせている。
ダメージ計算の正としては使わず、最終計算は必ず `src/calc/smogonAdapter.ts` 経由で `@smogon/calc` に渡す。

`Generations.get(9)` は National Dex 的に広い catalog を返すため、UI 対象範囲や未対応表示の絞り込みは後続の support matrix / overlay で扱う。

UI はまだ検証用の薄い smoke 表示だけ。
本格的な入力フォームや gh-pages 公開は後続 milestone で扱う。
