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

Milestone 0 の最小土台を実装済み。

現在できること:

- React + Vite + TypeScript + Vitest で起動・test・build できる
- `@smogon/calc` を導入し、`scripts/inspect-smogon-calc.mjs` で API / version / smoke calculation を確認できる
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

UI はまだ検証用の薄い smoke 表示だけ。
本格的な入力フォームや gh-pages 公開は後続 milestone で扱う。
