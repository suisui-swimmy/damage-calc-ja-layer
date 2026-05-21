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

Milestone 6 の最小 Web UI MVP を実装済み。

現在できること:

- React + Vite + TypeScript + Vitest で起動・test・build できる
- `@smogon/calc` を導入し、`scripts/inspect-smogon-calc.mjs` で API / version / smoke calculation を確認できる
- `@smogon/calc` Gen9 から Pokemon / Move / Item / Ability / Nature / Type の calc catalog を再生成できる
- calc catalog の schema / 必須キー / id 重複 / 現在の `@smogon/calc` Gen9 との差分を検証できる
- ChampionCreator 由来の生成済み options JSON を `src/data/generated/` にコピー済み
- 日本語入力を canonical name へ解決する resolver の固定ケースをテストできる
- resolver は `exact` / `alias` / `fuzzy` / `ambiguous` / `not-found` を明示し、候補提示用に `matchedBy` / `matchText` / `sourceStatus` を返せる
- resolver 済み canonical name だけを `src/calc/smogonAdapter.ts` へ渡し、`@smogon/calc` の計算結果を UI / formatter 用の最小構造へ変換できる
- formatter で adapter output を日本語 UI 用の表示構造へ変換できる
- 攻撃側 / 防御側 / 技 / 持ち物 / 特性 / 性格 / 天候 / フィールド / 壁を、adapter output に存在する範囲だけ日本語表示できる
- 日英対応一覧を中心に、resolver trace と formatter result を確認できる最小 Web UI がある
- ChampionCreator 由来の公式イラスト asset を、メイン導線の UI asset として `public/assets/official-artwork/` に配置済み

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
| Ability | せいでんき | Static |
| Nature | ひかえめ | Modest |
| Type | でんき | Electric |

## 開発コマンド

```bash
npm install
npm run generate:calc-catalog
npm run validate:calc-catalog
npm run validate:ja-mapping
npm run validate:artwork-assets
npm run inspect:calc
npm test
npm run build
npm run dev
```

GitHub Pages 公開前には、Actions で `npm test` と `npm run build` が通る状態にする。

## 実装済みの主な境界

- `src/localization/normalizeJa.ts`: 日本語・英語入力の検索用正規化
- `src/localization/resolver.ts`: entity kind ごとの日本語入力 -> canonical name 解決、候補提示用 metadata 生成
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

## 日本語 mapping 検証

ChampionCreator 由来の options JSON と `@smogon/calc` 由来の calc catalog を照合する。

```bash
npm run validate:ja-mapping
```

検証対象:

- `src/data/generated/pokemon-options.gen.json` と `src/data/generated/calc-species.gen.json`
- `src/data/generated/move-options.gen.json` と `src/data/generated/calc-moves.gen.json`
- `src/data/generated/item-options.gen.json` と `src/data/generated/calc-items.gen.json`
- `src/data/generated/ability-options.gen.json` と `src/data/generated/calc-abilities.gen.json`
- `src/data/generated/nature-options.gen.json` と `src/data/generated/calc-natures.gen.json`
- `src/data/generated/type-options.gen.json` と `src/data/generated/calc-types.gen.json`

この script は、`id` / `showdownName` が calc catalog 側に存在するか、重複、空 label、空 `searchText`、catalog 側だけにある entry を summary で出す。
`sourceStatus` と `fallback.reason` は握りつぶさず集計し、ChampionCreator 由来の暫定データや `needs-confirmation` を可視化する。

現時点では欠損の可視化を優先するため、calc catalog 側だけにある Pokemon や `needs-confirmation` の Ability は summary と warning に留める。
生成済み JSON を手で直接修正せず、追加の別名や表示名補正は `src/data/overrides/ja-aliases.json` / `src/data/overrides/ja-label-overrides.json` に積む。
manual overlay は `src/localization/resolver.ts` で generated options に薄く重ね、生成元データを直接編集しない。

UI はまだ検証用の薄い smoke 表示だけ。
本格的な入力フォームや gh-pages 公開は後続 milestone で扱う。

## Pokemon artwork assets

ポケモン画像は、おまけではなくメイン導線の UI asset として扱う。
正式な参照元は `src/data/generated/pokemon-options.gen.json` の `artwork` フィールドで、UI はこの path を使って必要な画像だけを `<img loading="lazy">` で読む。
初回ロードで全画像を import したり、計算ロジックへ画像情報を渡したりしない。

画像は ChampionCreator 由来の UI 表示用 asset であり、`@smogon/calc` 由来ではない。
画像の有無、ファイル名、表示 fallback は計算の正しさに関与しない。
ダメージ計算は引き続き resolver 済み canonical name を `src/calc/smogonAdapter.ts` に渡し、`@smogon/calc` を唯一の正として扱う。

`public/assets/official-artwork/` には、`pokemon-options.gen.json` から参照される 1,310 個の PNG だけを配置している。
元の ChampionCreator 側フォルダには 1,337 個の PNG があるが、27 個は現在の options JSON から参照されていないため、この repo では参照分だけを採用した。
これにより deploy artifact は約 159MB 増える。
画像をメイン導線の一覧・候補表示で使う前提なのでこの重さは許容し、未参照画像は必要になった時点で options JSON 側の参照と一緒に追加する。

画像参照の検証:

```bash
npm run validate:artwork-assets
```

この script は `pokemon-options.gen.json` の `artwork` が `public/` 配下に実在するかを確認する。
missing / invalid があれば非0終了し、unused PNG があれば summary と sample に出す。
画像が欠けても UI は文字マークへ fallback するが、公開前にはこの validation を通す。

## Resolver MVP

`src/localization/resolver.ts` は、UI 入力を `@smogon/calc` に渡せる canonical name へ変換する入口。
必ず `kind` と `input` を受け取り、Pokemon / Move / Item / Ability / Nature / Type を混ぜずに解決する。

返却 status:

- `exact`: 日本語 label、英語 canonical name、または calcId に一致
- `alias`: generated options の `searchText` token、または manual alias overlay に一致
- `fuzzy`: `allowFuzzy: true` のとき、検索文字列の部分一致が 1 件に絞れた
- `ambiguous`: 複数候補が残った。resolver 側では 1 件に潰さない
- `not-found`: 候補なし。fallback 表示や手入力確認に進める

候補には `canonicalName`、`calcId`、`displayNameJa`、`sourceStatus`、`reason`、`matchedBy`、`matchText` を載せる。
UI は `ambiguous` / `not-found` を握りつぶさず、候補提示や確認導線へ進める。
adapter へ渡すのは、resolver 済みの `canonicalName` に限定する。

manual overlay は generated options を直接編集せず、次の外側データとして管理する。

- `src/data/overrides/ja-aliases.json`: 表記揺れや略称を追加する
- `src/data/overrides/ja-label-overrides.json`: 表示名の補正を追加する

`npm run validate:ja-mapping` は overlay の `kind:id` が calc catalog に存在するかも検証する。
壊れた manual overlay は validation error として扱い、generated JSON 側は手で直さない。

## Calc Adapter MVP

`src/calc/smogonAdapter.ts` は、resolver 済み canonical name を `@smogon/calc` へ渡す唯一の呼び出し境界。
adapter は日本語入力や UI state を直接受け取らず、Pokemon / Move / Item / Ability / Nature / Type は canonical name 前提の `canonicalName` / `item` / `ability` / `nature` / `teraType` として扱う。

現時点の入力範囲:

- Pokemon: `canonicalName`、`level`、`item`、`ability`、`nature`、`evs`、`ivs`、`boosts`、`teraType`、`curHP`
- Move: `canonicalName`、`isCrit`、`hits`
- Field: `gameType`、`weather`、`terrain`、`attackerSide`、`defenderSide`
- Side condition: `isReflect`、`isLightScreen`、`isProtected`、`isAuroraVeil`、`isHelpingHand` など、`@smogon/calc` の `Field` が受け取れる boolean / numeric flag

adapter output は formatter / UI が読むための最小構造に落とす。
主な値は `damageRolls`、`damageRange`、`rawDescription`、攻撃側 / 防御側 / 技 / 場の canonical summary。
`rawDescription` は検証用に残すが、formatter の表示文言を adapter や resolver のロジックへ再利用しない。

adapter は独自のダメージ計算式、タイプ相性、乱数、技威力補正を持たない。
テストでは direct `calculate(...)` の `damage` / `range()` と adapter output を比較し、adapter が薄い変換層に留まっていることを確認する。

## Formatter MVP

`src/formatters/jaResultFormatter.ts` は、`src/calc/smogonAdapter.ts` の output を日本語 UI 表示用の構造へ変換する表示専用層。
formatter は `@smogon/calc` を直接呼ばず、英文 `rawDescription` を再パースしてロジックを作らない。

現時点で返す主な表示情報:

- 攻撃側、防御側、技の日本語表示名と canonical name
- 持ち物、特性、性格、テラスタイプの日本語表示名と canonical name
- ダメージ最小 / 最大、乱数 roll、adapter が渡す割合表示
- `@smogon/calc` の `kochance()` から adapter が取り出した KO chance の構造値と原文 source
- 天候、フィールド、壁や場条件の日本語ラベル
- `rawDescription` / `sourceDescription` は検証用 source として保持

日本語名は resolver / generated mapping / manual overlay 経由で引き、見つからない場合は canonical name を fallback 表示する。
確定数、乱数表現、割合などは adapter が `@smogon/calc` から安全に渡せる範囲だけ表示し、取れない情報を formatter 側で仮補完しない。
KO chance の英文 `sourceText` は検証用に残すが、日本語表示のために英文を分解して再利用しない。

## Minimal Web UI MVP

`src/App.tsx` は、検索フォームを主役にせず、日本語名と Smogon / Showdown canonical name の対応表を主役にした検証 UI。
中央の一覧で Pokemon / Move / Item / Ability / Nature / Type の代表対応を確認し、右側の `resolver trace` で日本語入力が canonical name へ解決される流れを確認できる。
下部の `formatter result` は、固定代表ケースを resolver 済み canonical name で adapter へ渡し、formatter output を日本語表示したもの。

画像は `@smogon/calc` 由来ではなく、ChampionCreator 由来 options の `artwork` パスに対応するメイン導線の UI asset として扱う。
Pokemon 行は `src/data/generated/pokemon-options.gen.json` の `artwork` を参照し、必要になった画像だけを `<img loading="lazy">` で読み込む。
画像が存在しない entity では、計算や resolver に影響させず、UI 上の文字マークへ fallback する。
UI からも `@smogon/calc` を直接呼ばず、計算は `src/calc/smogonAdapter.ts` 経由に留める。
