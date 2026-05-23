# damage-calc-ja-layer

`@smogon/calc` の外側に、日本語入力・日本語表示のレイヤーを載せるプロジェクトです。
Smogon / Showdown 側の計算エンジンは改変せず、日本語 UI をオーバーレイします。

```text
日本語 UI / 日本語入力
  -> 日本語名 resolver
  -> Smogon / Showdown canonical name
  -> @smogon/calc
  -> 日本語 formatter
  -> 日本語の計算結果表示
```

## できること

- Pokemon / Move / Item / Ability / Nature / Type の日本語入力を canonical name へ解決する
- `exact` / `alias` / `fuzzy` / `ambiguous` / `not-found` を明示し、候補提示用 metadata を返す
- resolver 済み canonical name だけを `src/calc/smogonAdapter.ts` へ渡して `@smogon/calc` で計算する
- 計算結果を `src/formatters/jaResultFormatter.ts` で日本語表示用の構造へ変換する
- 日本語の計算条件入力から resolver -> adapter -> formatter を通して、ブラウザでダメージ結果を確認する
- 計算条件を `schemaVersion` 付き JSON として copy / import する
- `@smogon/calc` Gen9 由来の calc catalog を再生成・検証する
- GitHub Actions で validation / test / build / GitHub Pages deploy を実行する

## 方針

- `@smogon/calc` を計算の唯一の正とし、独自のダメージ計算式は実装しない
- `@smogon/calc` 呼び出しは `src/calc/smogonAdapter.ts` に閉じ込める
- 日本語入力の解決は `src/localization/`、日本語表示は `src/formatters/` に分ける
- 生成済み JSON は手で直接直さず、補正は `src/data/overrides/` に積む
- 画像や日本語名は UI 補助であり、計算の正しさには関与させない

## 開発コマンド

```bash
npm install
npm run dev
npm test
npm run build
```

公開前やデータ更新後の確認は次を実行する。

```bash
npm run validate:calc-catalog
npm run validate:ja-mapping
npm run validate:artwork-assets
npm run inspect:calc
npm test
npm run build
```

## 代表確認ケース

| 種別 | 日本語入力 | canonical name |
| --- | --- | --- |
| Pokemon | ピカチュウ | Pikachu |
| Move | 10まんボルト | Thunderbolt |
| Move | きあいだま | Focus Blast |
| Item | こだわりメガネ | Choice Specs |
| Ability | せいでんき | Static |
| Nature | ひかえめ | Modest |
| Type | でんき | Electric |

## 主な構成

- `src/localization/normalizeJa.ts`: 日本語・英語入力の検索用正規化
- `src/localization/resolver.ts`: entity kind ごとの日本語入力 -> canonical name 解決
- `src/calc/smogonAdapter.ts`: `@smogon/calc` 呼び出し境界
- `src/formatters/jaResultFormatter.ts`: calc 結果の日本語表示用 formatter
- `src/domain/shareState.ts`: 計算条件 JSON の schemaVersion / serialize / parse
- `src/data/generated/*.gen.json`: 日本語 options JSON
- `src/data/generated/calc-*.gen.json`: `@smogon/calc` Gen9 由来の canonical catalog
- `src/data/overrides/`: 日本語 alias / 表示名補正の manual overlay
- `public/assets/official-artwork/`: UI 表示用の公式イラスト asset

## Resolver

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
計算導線では `exact` / `alias` の resolver 結果だけを adapter へ渡し、`fuzzy` は候補確認止まりにする。

## Calc Adapter

`src/calc/smogonAdapter.ts` は、resolver 済み canonical name を `@smogon/calc` へ渡す唯一の呼び出し境界。
adapter は日本語入力や UI state を直接受け取らず、Pokemon / Move / Item / Ability / Nature / Type は canonical name 前提で扱う。

入力範囲:

- Pokemon: `canonicalName`、`level`、`item`、`ability`、`nature`、`evs`、`ivs`、`boosts`、`teraType`、`curHP`
- Move: `canonicalName`、`isCrit`、`hits`
- Field: `gameType`、`weather`、`terrain`、`attackerSide`、`defenderSide`
- Side condition: `isReflect`、`isLightScreen`、`isProtected`、`isAuroraVeil`、`isHelpingHand` など、`@smogon/calc` の `Field` が受け取れる boolean / numeric flag

adapter output は formatter / UI が読むための最小構造に落とす。
主な値は `damageRolls`、`damageRange`、`damagePercentageRange`、`koChance`、`rawDescription`、攻撃側 / 防御側 / 技 / 場の canonical summary。
`rawDescription` は検証用に残すが、formatter や resolver のロジックへ再利用しない。

## Formatter

`src/formatters/jaResultFormatter.ts` は、adapter output を日本語 UI 表示用の構造へ変換する表示専用層。
formatter は `@smogon/calc` を直接呼ばず、英文 `rawDescription` を再パースしてロジックを作らない。

返す主な表示情報:

- 攻撃側、防御側、技の日本語表示名と canonical name
- 持ち物、特性、性格、テラスタイプの日本語表示名と canonical name
- ダメージ最小 / 最大、乱数 roll、割合表示
- `@smogon/calc` の `kochance()` 由来の KO chance 構造値と原文 source
- 天候、フィールド、壁や場条件の日本語ラベル
- 検証用の `rawDescription` / `sourceDescription`

日本語名が見つからない場合は canonical name を fallback 表示する。
確定数、乱数表現、割合などは adapter が `@smogon/calc` から安全に渡せる範囲だけ表示し、取れない情報を formatter 側で仮補完しない。

## Web UI

`src/App.tsx` は、日本語入力から canonical name 解決、`@smogon/calc` adapter、formatter result までをブラウザで確認する UI。

- `resolver input`: Pokemon / Move / Item / Ability / Nature / Type の候補を確認する
- `日英対応`: generated options と resolver 候補を一覧表示する
- `resolver trace`: 選択中の入力が canonical name へ解決される流れを確認する
- `計算条件`: 攻撃側、防御側、技、持ち物、特性、性格、天候、フィールド、ひかりのかべを入力する
- `formatter result`: `@smogon/calc` の結果を日本語表示する

計算条件は `schemaVersion: 1` の JSON として textarea に表示される。
`copy JSON` は現在の条件を JSON 化し、`import JSON` は textarea の JSON を読み戻す。
round-trip の純粋関数は `src/domain/shareState.ts` に分離し、`src/domain/shareState.test.ts` で検証する。

## データ生成と検証

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
補助 metadata は UI 表示や検証用のヒントとして持たせているが、ダメージ計算の正としては使わない。

```bash
npm run validate:ja-mapping
```

この script は、`id` / `showdownName` が calc catalog 側に存在するか、重複、空 label、空 `searchText`、catalog 側だけにある entry を summary で出す。
`sourceStatus` と `fallback.reason` は握りつぶさず集計し、暫定データや `needs-confirmation` を可視化する。

日本語名、別名、表示名の補正は generated JSON を手で直さず、次へ追加する。

- `src/data/overrides/ja-aliases.json`
- `src/data/overrides/ja-label-overrides.json`

## Pokemon Artwork

ポケモン画像は、メイン導線の UI asset として扱う。
正式な参照元は `src/data/generated/pokemon-options.gen.json` の `artwork` フィールドで、UI はこの path を使って必要な画像だけを `<img loading="lazy">` で読む。
初回ロードで全画像を import したり、計算ロジックへ画像情報を渡したりしない。

`public/assets/official-artwork/` には、`pokemon-options.gen.json` から参照される 1,310 個の PNG だけを配置している。
deploy artifact は画像により約 159MB 増える。

画像参照の検証:

```bash
npm run validate:artwork-assets
```

missing / invalid があれば非0終了し、unused PNG があれば summary と sample に出す。
画像が欠けても UI は文字マークへ fallback するが、公開前にはこの validation を通す。

## Deploy

GitHub Pages は `.github/workflows/deploy.yml` の official Pages Actions flow で公開する。
`main` へ push すると、`npm ci`、各 validation、`npm test`、`npm run build` を通したあと、`dist/` を Pages artifact として deploy する。

GitHub 側の Pages 設定:

```text
Repository settings -> Pages -> Source -> GitHub Actions
```

Vite は `base: "./"` のため、`https://<user>.github.io/damage-calc-ja-layer/` のような project pages 配置でも JS / CSS / public assets を相対 path で読める。

## データ更新手順

`@smogon/calc` 更新や generated catalog の差分確認をする場合は、次の順で扱う。

```bash
npm install
npm run inspect:calc
npm run generate:calc-catalog
npm run validate:calc-catalog
npm run validate:ja-mapping
npm run validate:artwork-assets
npm test
npm run build
```

画像参照を増やした場合は `public/assets/official-artwork/` と `src/data/generated/pokemon-options.gen.json` の `artwork` を揃え、`npm run validate:artwork-assets` を通す。

## 制限

- `Generations.get(9)` は National Dex 的に広い catalog を返すため、CAP や暫定データは validation summary / `sourceStatus` で可視化する
- Champions 新特性 4 件は `needs-confirmation` として扱い、`@smogon/calc` に存在しないものは adapter で計算しない
- Type `unknown -> ???` は calc catalog の empty id と対応するため、`validate:ja-mapping` では warning として残す
- generated JSON を静的 import しているため、build の large chunk warning は残る
- KO chance の詳細文は `@smogon/calc` の構造値から取れる最小表示に留め、英文 `sourceText` の完全日本語化は未対応
