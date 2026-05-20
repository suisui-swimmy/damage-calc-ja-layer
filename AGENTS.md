# プロジェクト概要

このプロジェクトは、`@smogon/calc` を直接日本語化するのではなく、`@smogon/calc` の外側に日本語入力・日本語表示のレイヤーを作るための土台である。

目的は、日本語版ポケモンダメージ計算アプリで次の流れを安定して扱えるようにすること。

```text
日本語 UI / 日本語入力
  ↓
日本語名・別名・表記揺れを Smogon / Showdown 用 canonical 名へ解決
  ↓
@smogon/calc
  ↓
計算結果
  ↓
日本語表示用フォーマッター
  ↓
日本語の計算結果表示
```

`@smogon/calc` 側のソースコードやデータを直接改変しない。
Smogon 側の更新に追従するときは、このプロジェクトの日本語レイヤー、生成データ、adapter、formatter だけを更新して対応する。

# PROGRESS.md について
プロジェクトの進捗は`PROGRESS.md`を参照し、個人用の汎用 skill progress-update を使い、PROGRESS.mdに作業内容に記録してください。 汎用 skill progress-update は ~/.codex/skills に配置されています。

# 最重要方針

## 個人情報について
- git追跡ファイルに個人情報 / 絶対パス / 秘匿すべき情報を入れない

## 最優先ゴールは `@smogon/calc` の完全日本語化レイヤー

このプロジェクトの最優先は、`@smogon/calc` が扱う主要な入力・出力を、日本語 UI で自然に使える状態にすること。

優先順位:

1. Pokemon / Move / Item / Ability / Nature / Type の日本語入力から canonical name への解決
2. `@smogon/calc` の計算結果を日本語で読める formatter
3. 未解決・曖昧一致・fallback・needs-confirmation をユーザーが確認できる検証導線
4. 最小 Web UI
5. GitHub Pages 公開

GitHub Pages は最後でよい。
まずはローカルで resolver / adapter / formatter の完全性と検証しやすさを優先する。

## `@smogon/calc` を計算の唯一の正とする

このプロジェクトでは、ダメージ計算式・タイプ相性・乱数ダメージ・技威力補正・特性や持ち物の主要補正を独自実装しない。

アプリ側で実装してよい責務は次に限定する。

- 日本語 UI 入力モデル
- 日本語名、別名、表記揺れの正規化
- 日本語名から Smogon / Showdown canonical 名への解決
- `@smogon/calc` への薄い adapter
- 計算結果の日本語 formatter
- UI 表示、検索、補助ラベル
- 計算条件の保存、共有、再現
- データ生成・検証スクリプト

計算結果に関わる処理は、最終的に必ず `@smogon/calc` を通す。
UI、検索、formatter、生成 JSON の値を使って、独自のダメージ結果を作らない。

## Smogon 側をいじらない

`@smogon/calc` は外部依存として扱い、fork や vendoring を前提にしない。

必要な対応は、次のどれかに閉じ込める。

- `src/calc/smogonAdapter.ts`
- `src/localization/*`
- `src/formatters/*`
- `src/data/generated/*`
- `src/data/overrides/*`
- `scripts/*`

Smogon 側の仕様差分や未対応仕様が見つかった場合も、まずは上流の API・型・データで表現できるか確認する。
どうしても補助が必要な場合は、計算本体ではなく adapter か overlay に隔離し、README とテストで信頼境界を明記する。

# 用語

- `canonical name`: `@smogon/calc` の `Pokemon`, `Move`, `Item`, `Ability`, `Nature`, `Type` などへ渡す英語名。例: `Pikachu`, `Thunderbolt`, `Choice Specs`
- `calcId`: `@smogon/calc` の `toID` と同じ考え方で作る検索・照合用 ID。例: `thunderbolt`
- `displayNameJa`: UI に表示する日本語名。例: `10まんボルト`
- `aliasesJa`: 日本語の別名、略称、入力揺れ。例: `["10万ボルト", "十万ボルト"]`
- `resolver`: ユーザー入力を entity kind ごとに canonical name へ変換する層
- `formatter`: `@smogon/calc` の結果を日本語 UI 表示へ変換する層
- `overlay`: 上流データだけでは足りない日本語名、別名、注意表示、暫定分類を追加する薄い差分データ

# 対象 entity

初期 MVP で優先する entity は次の通り。

- Pokemon
- Move
- Item
- Ability
- Nature
- Type
- Field condition
- Weather
- Terrain
- Side condition
- Stat label
- Damage result label

技の威力・タイプ・カテゴリなどは UI 補助として表示してよい。
ただし、最終計算では canonical name と明示的な手入力 override を `@smogon/calc` adapter へ渡し、生成 JSON を計算式の正にしない。

# データ設計

## データの分離

次のデータを混ぜない。

- `calc catalog`: `@smogon/calc` から生成する英語 canonical catalog
- `ja mapping`: 日本語名、別名、検索文字列、表示ラベル
- `manual overrides`: 上流にない日本語名、暫定ラベル、表記揺れ、注意表示
- `support matrix`: 計算結果に影響する仕様の対応状況

日本語名は UI 補助であり、計算の正ではない。

## 推奨ディレクトリ

```text
scripts/
  inspect-smogon-calc.mjs
  generate-calc-catalog.mjs
  generate-ja-mapping.mjs
  validate-ja-mapping.mjs
  generate-ui-options.mjs
src/
  calc/
    smogonAdapter.ts
    smogonAdapter.test.ts
  data/
    generated/
      calc-species.gen.json
      calc-moves.gen.json
      calc-items.gen.json
      calc-abilities.gen.json
      calc-natures.gen.json
      calc-types.gen.json
      ja-species.gen.json
      ja-moves.gen.json
      ja-items.gen.json
      ja-abilities.gen.json
      ja-natures.gen.json
      ja-types.gen.json
      localized-search-index.gen.json
    overrides/
      ja-aliases.json
      ja-label-overrides.json
      support-matrix.json
  domain/
    entities.ts
    result.ts
  localization/
    normalizeJa.ts
    resolver.ts
    resolver.test.ts
    searchIndex.ts
  formatters/
    jaResultFormatter.ts
    jaResultFormatter.test.ts
  ui/
    ...
README.md
```

既存実装ができてからは、既存のディレクトリ構成を優先する。
ただし、UI から `@smogon/calc` を直接呼ぶ構造にはしない。

## JSON payload の基本形

生成データは、出所とバージョンを追える形にする。

```ts
interface LocalizedEntityPayload<TKind extends string, TEntry> {
  schemaVersion: number;
  dataVersion: string;
  source: Record<string, string | number | boolean>;
  generatedBy: string;
  kind: TKind;
  entries: TEntry[];
  summary: Record<string, string | number | boolean>;
}

interface LocalizedEntityEntry {
  id: string;
  kind: "pokemon" | "move" | "item" | "ability" | "nature" | "type";
  showdownName: string;
  displayNameJa: string;
  aliasesJa: string[];
  searchText: string;
  sourceStatus?: "supported" | "adapter-temporary" | "needs-confirmation" | "unsupported-temporary";
  notes?: string;
}
```

`id` は `toID(showdownName)` 相当を基本にする。
日本語入力から直接 `id` を作って計算に渡さない。
resolver は必ず entity kind を受け取り、候補を曖昧にしない。

# 日本語入力・検索設計

## 正規化

日本語入力は `src/localization/normalizeJa.ts` に閉じ込める。

最初に扱う正規化:

- 全角・半角の揺れ
- ひらがな・カタカナの検索補助
- 大文字・小文字
- 空白、記号、長音、なかぐろの扱い
- 数字表記の揺れ
- 英語 canonical name の直接入力

正規化は検索・照合のための処理であり、表示名を書き換えるための処理ではない。

## resolver

resolver は次の入力を受ける。

- entity kind
- ユーザー入力
- 世代またはルールセット
- optional: 曖昧一致を許すかどうか

返す値は次の形を基本にする。

```ts
type ResolveStatus = "exact" | "alias" | "fuzzy" | "ambiguous" | "not-found";

interface ResolveResult {
  status: ResolveStatus;
  input: string;
  kind: string;
  canonicalName?: string;
  calcId?: string;
  displayNameJa?: string;
  candidates?: Array<{
    canonicalName: string;
    displayNameJa: string;
    reason: string;
  }>;
}
```

`ambiguous` と `not-found` を握りつぶさない。
UI では候補提示、テストでは期待結果として扱う。

# `@smogon/calc` adapter 方針

`src/calc/smogonAdapter.ts` は薄く保つ。

adapter の責務:

- resolver 済み canonical name を `Pokemon`, `Move`, `Field`, `calculate` に渡す
- `@smogon/calc` の package version と主要 API を検査できるようにする
- `Result` から、UI と formatter が使う最小限の構造へ変換する
- 手入力 override を `@smogon/calc` が受け取れる形に変換する
- `@smogon/calc` の型や option shape が変わったときの影響範囲をここに閉じる

adapter でやってはいけないこと:

- 日本語名の検索ロジックを持つ
- UI state を直接受け取る
- 独自ダメージ式を持つ
- 生成 JSON の技威力やタイプ表を使って最終ダメージを計算する

# 日本語 formatter 方針

`src/formatters/jaResultFormatter.ts` は、計算結果の説明文を日本語表示へ変換する。

初期で扱う表示:

- 最小・最大ダメージ
- ダメージ割合
- 乱数幅
- 確定数
- 乱数 1 発 / 2 発などの確率
- 攻撃側、防御側、技、持ち物、特性、天候、フィールド、壁
- 注意表示や未対応表示

formatter は表示専用にする。
formatter の文言を再パースしてロジックに使わない。

# `others/` の扱い

`others/` は調査・移植候補の素材置き場であり、アプリから直接 import しない。
このディレクトリ自体は git 追跡に乗せない。

使えそうな素材を採用する場合は、必要なファイルだけをこのプロジェクトの `scripts/`、`src/data/overrides/`、`public/assets/` などへコピーまたは移植する。
その際、再生成方法や移植元のメモは README またはデータ管理ドキュメントに軽く残す。

現時点で参考にしやすい候補:

- `others/ChampionCreator/scripts/inspect-smogon-calc.mjs`
- `others/ChampionCreator/scripts/generate-calc-data.mjs`
- `others/ChampionCreator/scripts/generate-battle-options.mjs`
- `others/ChampionCreator/scripts/generate-pokemon-options.mjs`
- `others/ChampionCreator/scripts/generate-localized-search-index.mjs`
- `others/ChampionCreator/src/data/generated/*-options.gen.json`
- `others/ChampionCreator/src/data/generated/localized-search-index.gen.json`
- `others/pokemon-data/POKEMON_ALL.json`
- `others/pokemon-data/ITEM_ALL.json`
- `others/pokemon-data/schema.ts`
- `others/damage-calc/calc/`

日本語対応データは、まず `others/ChampionCreator/src/data/generated/` の生成済み JSON を優先する。
不足、誤り、表記揺れ、フォーム差分が見つかった場合だけ、`others/pokemon-data/POKEMON_ALL.json`、`others/pokemon-data/ITEM_ALL.json`、`others/damage-calc/calc/` などへ fallback する。

`others/` の中身をそのまま本体設計に混ぜない。
ただし、素材や生成済み JSON がそのまま使えそうな場合は、必要な範囲だけコピーして使ってよい。
コピー後は、このプロジェクト内の `scripts/` や `src/data/generated/` から再利用できる形に整える。

`others/ChampionCreator/src/data/generated/` の生成済み JSON は実用データとして参考にしてよい。
ただし、再生成に必要な元データがこの checkout 内に存在しない場合がある。
生成済み JSON を採用・移植する前に、対応する生成スクリプト、入力元、再生成可能性を確認する。

ChampionCreator はユーザー本人の個人プロジェクトなので、ライセンス確認で作業を止めない。
必要に応じて自由に参照・移植してよい。

# 技術方針

- TypeScript ベースで実装する
- Web アプリとしてブラウザで動く構成を基本にする
- GitHub Pages で静的ホスティングできる構成を優先する
- 実行時外部 API や実行時 scraping に依存しない
- 必要データはビルド時生成または静的ファイルとして同梱する
- 計算層、localization 層、formatter 層、UI 層を分ける
- UI コンポーネントに resolver や `@smogon/calc` 呼び出しを直書きしない
- 大きい検索 index は必要に応じて遅延 import する
- 保存データには `schemaVersion` を持たせる
- アプリバージョン、`@smogon/calc` バージョン、データバージョンを表示・出力できるようにする
- 画像は MVP の必須範囲にしない。日本語名解決と計算結果表示を優先する

フレームワーク未決定の場合、React + Vite + TypeScript をデフォルト候補とする。
ただし、実装が始まった後は既存構成を優先する。

# テスト方針

最低限、次をテストする。

- 日本語名から canonical name へ解決できる
- 英語 canonical name を直接入力しても解決できる
- 表記揺れ・別名が期待通りに解決される
- 曖昧入力が `ambiguous` として返る
- 未登録入力が `not-found` として返る
- Pokemon / Move / Item / Ability / Nature / Type を entity kind ごとに解決できる
- `@smogon/calc` adapter の smoke test が通る
- `Pikachu` / `Thunderbolt` のような代表ケースで計算できる
- `ピカチュウ` / `10まんボルト` のような日本語入力から同じ計算に到達できる
- formatter が日本語表示を返す
- 生成データの schema validation が通る
- `@smogon/calc` の version 更新時に catalog 差分を検知できる
- JSON import / export で計算条件を round-trip できる

計算結果の正しさは独自式ではなく、`@smogon/calc` の結果を基準に検証する。

# MVP マイルストーン

## Milestone -1: 設計と素材棚卸し

- `@smogon/calc` の API、version、license、export を確認する
- `others/` の素材を棚卸しする
- ChampionCreator の生成済み日本語データを優先し、不足分の fallback 候補を分ける
- 日本語名 mapping の schema を決める
- resolver / adapter / formatter の境界を決める

完了条件:

- AGENTS と README から設計方針を追える
- `others/` を直接 import しない方針が明文化されている
- ChampionCreator 優先データと fallback 候補が分かる

## Milestone 0: プロジェクト土台

- TypeScript プロジェクトを起動できる
- テスト環境を用意する
- `@smogon/calc` を導入する
- `scripts/inspect-smogon-calc.mjs` を用意する
- README に開発コマンドを書く

完了条件:

- `npm test` または同等のテストコマンドが動く
- `@smogon/calc` の最小 smoke test が通る
- package version と license を確認できる

## Milestone 1: calc catalog 生成

- `@smogon/calc` から Pokemon / Move / Item / Ability / Nature / Type の catalog を生成する
- `calcId` と canonical name を固定する
- 生成 JSON に `schemaVersion`、`dataVersion`、`source` を持たせる
- schema validation を用意する

完了条件:

- Gen9 の主要 catalog を生成できる
- `@smogon/calc` version 更新時に差分を確認できる

## Milestone 2: 日本語 mapping MVP

- Pokemon / Move / Item / Ability / Nature / Type の日本語名 mapping を生成または移植する
- `displayNameJa`、`aliasesJa`、`searchText` を持つ
- mapping の欠損と fallback を summary に出す
- 手動 overlay を足せる

完了条件:

- `ピカチュウ`、`10まんボルト`、`こだわりメガネ`、`きあいだま` を canonical name へ解決できる
- 欠損がある場合も英語 fallback として扱える

## Milestone 3: resolver MVP

- entity kind ごとの resolver を実装する
- 完全一致、別名一致、英語 canonical 直接入力を扱う
- 曖昧一致と未検出を明示する
- UI から使える候補形式を返す

完了条件:

- 日本語入力から `@smogon/calc` adapter に渡す canonical name が得られる
- 曖昧入力を勝手に 1 件へ潰さない

## Milestone 4: calc adapter MVP

- `@smogon/calc` を薄い adapter 経由で呼ぶ
- Pokemon / Move / Field / calculate の代表ケースを通す
- resolver 済み canonical name だけを受け取る
- UI や formatter から `@smogon/calc` へ直接依存しない

完了条件:

- 日本語入力を resolver で canonical name に変換し、adapter 経由で計算できる
- adapter の単体テストがある

## Milestone 5: 日本語 formatter MVP

- `@smogon/calc` の結果を日本語表示用構造へ変換する
- 日本語名 mapping を使って表示名を戻す
- ダメージ範囲、割合、確定数、注意表示を出す

完了条件:

- `ピカチュウ`、`10まんボルト` などの日本語名で結果を表示できる
- formatter のテストがある

## Milestone 6: 最小 Web UI

- 日本語で攻撃側、防御側、技、持ち物、特性、性格、場を入力できる
- 候補サジェストを出せる
- 計算結果を日本語で表示できる
- JSON copy / import で計算条件を再現できる
- app version / calc version / data version を表示できる

完了条件:

- ブラウザで日本語入力から計算結果表示まで試せる
- UI は仮でも、resolver / adapter / formatter の境界が保たれている

## Milestone 7: 公開準備

- README に使い方、制限、データ更新手順を書く
- GitHub Actions で test / build を走らせる
- GitHub Pages の静的デプロイを用意する
- 代表ケースの回帰テストを増やす

完了条件:

- 他人がローカルで動かせる
- 日本語 layer の責務と `@smogon/calc` 依存境界が README から分かる
- 日本語データの更新手順と未対応範囲が README から分かる

# 実装時の注意

- まず `@smogon/calc` の実 API と型を確認してから schema を固める
- 生成データは手で直さず、manual overlay で補正する
- 計算精度に関わる変更では、必ずテストか検証ログを残す
- 大きな設計変更をする前に、影響範囲と代替案を短く説明する
- `others/` の素材を採用するときは、ChampionCreator 由来データを優先し、必要な範囲だけ移植する
- ユーザー確認が必要な場合は、判断ポイントを短く具体的に聞く
- 重要なユーザー判断が不要な範囲は、確認待ちで止まらず実装・テスト・ドキュメント更新まで進める

# ユーザー判断が必要になりやすい箇所

次は勝手に決めすぎない。

- `@smogon/calc` 未対応仕様を adapter で仮対応するか、未対応表示に留めるか
- 公開範囲、GitHub Pages、push、PR、release
- ChampionCreator 優先データで足りない場合、どの fallback データを採用するか

# 機能追加の判断基準

採用しやすい変更:

- `@smogon/calc` への依存境界が薄く保てる
- 日本語 layer だけの更新で済む
- 静的ホストだけで動く
- 実行時外部 API が不要
- 手入力 fallback を強くする
- 計算条件の再現性が上がる
- README とテストで説明できる

慎重に扱う変更:

- 実行時 API、DB、サーバーが必要になる
- scraping の継続運用が必要になる
- 使用率や環境データの継続更新が必要になる
- `@smogon/calc` の内部実装へ深く依存する
- 日本語 mapping のために計算ロジックを分岐させる
- 保守しないとすぐ壊れる
