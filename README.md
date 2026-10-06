# damage-calc-ja-layer

`@smogon/calc` を使うポケモンダメージ計算のための、日本語入力・日本語表示レイヤーです。
ポケモン・技・持ち物・特性・性格・タイプの日本語名を計算用の英語名へ変換し、計算結果を日本語で表示します。
別のアプリから使える、Pokemon Showdown の英語名・IDから日本語表示を取得するAPIも提供します。

| 機能 | 入力 | 出力 | 主な用途 |
| --- | --- | --- | --- |
| 計算用の名前解決 | 日本語名・別名・英語名 | `@smogon/calc` 用の英語名と候補 | 日本語で計算条件を入力する |
| 計算と結果表示 | 解決済みの英語名と計算条件 | ダメージ・割合・KO確率の日本語表示 | ブラウザで計算結果を確認する |
| Showdown表示API | Showdownの英語名・ID | 日本語名・識別用の補足・対応状態 | 別のアプリで名前を表示する |

ダメージ計算はすべて `@smogon/calc` が行います。日本語名や画像は表示のための情報です。
Showdown表示APIで日本語名が得られても、その項目が計算可能・特定のゲームで使用可能という意味にはなりません。
実行時の外部APIや通信に依存せず、同梱データで動作します。

- [damage-calc-ja-layer](#damage-calc-ja-layer)
  - [ローカルで動かす](#ローカルで動かす)
  - [Web UIの使い方](#web-uiの使い方)
  - [ディレクトリ構成](#ディレクトリ構成)
  - [計算用API](#計算用api)
    - [名前解決（resolver）](#名前解決resolver)
    - [計算への受け渡し（adapter）](#計算への受け渡しadapter)
    - [日本語結果表示（formatter）](#日本語結果表示formatter)
  - [Showdown表示API](#showdown表示api)
    - [別のアプリへの組み込み](#別のアプリへの組み込み)
    - [返却値と対応状態](#返却値と対応状態)
    - [名前・フォームの扱い](#名前フォームの扱い)
    - [固定版の対応範囲](#固定版の対応範囲)
  - [データの管理と更新](#データの管理と更新)
    - [同梱データと補正](#同梱データと補正)
    - [日本語表示の更新](#日本語表示の更新)
    - [計算ライブラリの更新](#計算ライブラリの更新)
    - [取り込み元の再検証](#取り込み元の再検証)
    - [画像](#画像)
  - [検証コマンド](#検証コマンド)
  - [GitHub Pagesへの公開](#github-pagesへの公開)
  - [対応範囲と制限](#対応範囲と制限)

## ローカルで動かす

Node.js 22.12以上の22系とnpmを用意し、リポジトリのルートで実行します。CIもNode.js 22を使用します。

```bash
npm ci
npm run dev
```

ターミナルに表示されるURLをブラウザで開いてください。
ビルド済みのWeb UIを確認する場合は、次を使います。

```bash
npm run build
npm run preview
```

通常の開発・テスト・ビルドは、リポジトリに同梱されたデータと画像で実行できます。
上流のソースコードや日本語データの元ファイルは、取り込み元を再検証・更新する場合にだけ必要です。

## Web UIの使い方

Web UIは、日本語名の解決結果とダメージ計算を確認するための画面です。

1. `resolver input` で種別を選び、日本語名・英語名・IDを入力します。`日英対応` に候補、`resolver trace` に解決状態と英語名が表示されます。
2. `計算条件` に攻撃側のポケモン・持ち物・特性・性格、防御側のポケモン、技、天候、フィールド、ひかりのかべを入力します。
3. 名前を解決できると、日本語の計算結果とSmogonの原文が表示されます。複数候補がある入力や未登録の名前は、対象を確定してから計算します。
4. 条件を保存・共有するときは `copy JSON` を使います。読み戻すときはJSON欄へ貼り付け、`import JSON` を押します。

`fuzzy` は部分一致の候補を探す設定です。部分一致のままでは計算へ渡さず、候補の完全な名前で入力する必要があります。
条件JSONは `schemaVersion: 1` を持ち、画面で入力できる条件を保存します。adapterが扱えるすべての条件を保存する形式ではありません。
画面にはアプリ・計算ライブラリ・データのバージョンも表示されます。

入力例:

| 種別 | 日本語入力 | 計算用の英語名 |
| --- | --- | --- |
| ポケモン | ピカチュウ | `Pikachu` |
| 技 | 10まんボルト | `Thunderbolt` |
| 技 | きあいだま | `Focus Blast` |
| 持ち物 | こだわりメガネ | `Choice Specs` |
| 特性 | せいでんき | `Static` |
| 性格 | ひかえめ | `Modest` |
| タイプ | でんき | `Electric` |

## ディレクトリ構成

主要な追跡ファイルと、ビルドで作られる出力先を示します。
`*.test.ts` は検証対象のファイルと同じフォルダーに置いています。

```text
damage-calc-ja-layer/
├─ README.md
├─ package.json / package-lock.json   依存ライブラリと実行コマンド
├─ index.html                         Web UIのHTML入口
├─ vite.config.ts                     Web UIの開発・ビルド設定
├─ vite.showdown.config.ts            Showdown表示APIの配布用ビルド設定
├─ vitest.config.ts                   テスト設定
├─ tsconfig*.json                     TypeScriptの型検査・型定義出力設定
├─ .gitignore
├─ .github/workflows/
│  └─ deploy.yml                      検証・ビルド・GitHub Pagesへの公開
├─ src/
│  ├─ main.tsx                        Reactの起動処理
│  ├─ App.tsx                         名前検索・計算条件・結果表示の画面
│  ├─ style.css                       画面のスタイル
│  ├─ vite-env.d.ts                   Viteの型定義
│  ├─ showdown.ts                     Showdown表示APIの公開入口
│  ├─ calc/
│  │  └─ smogonAdapter.ts             @smogon/calcへの入力と結果の変換
│  ├─ domain/
│  │  └─ shareState.ts                計算条件JSONの形式・読み書き
│  ├─ localization/
│  │  ├─ normalizeJa.ts               全半角・かな・記号などの検索用正規化
│  │  ├─ resolver.ts                  計算用の名前解決と表示名の取得
│  │  ├─ displayNameRules.ts          日本語表示の補正・フォーム名の組み立て
│  │  ├─ showdownDisplay.ts           Showdown名・IDからの日本語表示取得
│  │  └─ showdownTypes.ts             Showdown表示APIの返却値の型
│  ├─ formatters/
│  │  ├─ jaResultFormatter.ts         計算結果の日本語表示
│  │  └─ smogonKoReferenceTranslator.ts  KO英文の表示専用参考訳
│  └─ data/
│     ├─ catalogTypes.ts / optionTypes.ts  カタログ・日本語辞書・補正の型
│     ├─ generated/
│     │  ├─ calc-*.gen.json           計算ライブラリ由来の英語カタログ
│     │  ├─ *-options.gen.json        日本語名・検索語・画像参照のスナップショット
│     │  ├─ showdown-catalog.gen.json  固定Showdown版の名前・フォーム構成
│     │  └─ showdown-display.gen.json  Showdown表示の対応状態と辞書参照
│     └─ overrides/
│        ├─ ja-aliases.json           計算用の別名・略称
│        ├─ ja-label-overrides.json   日本語表示名の補正
│        ├─ smogon-ko-reference-ja.json  KO英文の参考訳辞書
│        ├─ showdown-display-overrides.json  Showdown専用の表示・分類・出典
│        └─ showdown-pokemon-names.json  外部データから取り込んだ日本語名と元行
├─ scripts/
│  ├─ inspect-smogon-calc.mjs         計算ライブラリの版・API・ライセンス確認
│  ├─ generate-calc-catalog.mjs        英語カタログの生成
│  ├─ validate-calc-catalog.mjs        英語カタログと計算ライブラリの照合
│  ├─ validate-ja-mapping.mjs          日本語辞書・補正の構造と対応先の検証
│  ├─ validate-artwork-assets.mjs      画像参照・実ファイルの検証
│  ├─ import-showdown-catalog.mjs      固定Showdownソースから名前情報を抽出
│  ├─ import-showdown-pokemon-names.mjs  外部日本語名の元ファイル照合・再取り込み
│  ├─ generate-showdown-display.mjs    Showdown表示データの生成・一致検証
│  ├─ finalize-showdown-build.mjs     配布物へ型定義入口・ライセンスを同梱
│  ├─ lib/
│  │  ├─ showdown-pokemon-names.mjs   取り込んだ日本語名と元行の照合
│  │  ├─ showdown-shared-names.mjs    同じ日本語名を共有するID集合の検証
│  │  └─ showdown-shared-names.d.mts  共有名検証処理の型定義
│  └─ data/
│     ├─ showdown-source.lock.json    Showdownの参照commitとファイルのhash
│     └─ showdown-LICENSE.txt         同梱するShowdownライセンス文
├─ public/assets/official-artwork/    ポケモン画像
├─ dist/                             Web UIのビルド出力（Git追跡外）
└─ dist-showdown/                    Showdown表示APIの配布物（Git追跡外）
```

変更箇所を探すときの目安:

| 目的 | 主に読む・変更する場所 |
| --- | --- |
| 日本語入力や別名を扱う | `localization/resolver.ts`、`localization/normalizeJa.ts`、`data/overrides/ja-aliases.json` |
| 日本語の表示名を直す | `data/overrides/ja-label-overrides.json`、`localization/displayNameRules.ts` |
| 計算条件やライブラリとの受け渡しを変える | `calc/smogonAdapter.ts` |
| 計算結果の表示を変える | `formatters/` |
| 外部Showdownの名前表示を変える | `showdown.ts`、`localization/showdown*.ts`、Showdown専用補正と生成スクリプト |
| 計算条件JSONを変える | `domain/shareState.ts` |
| 画面を変える | `App.tsx`、`style.css` |

表のパスは `src/` からの相対パスです。生成済みJSONへの手修正ではなく、対応する補正・生成処理を変更します。

## 計算用API

処理は次の3層に分かれます。

```text
日本語入力
  → resolver: 日本語名・別名を計算用の英語名へ解決
  → adapter: @smogon/calcへ条件を渡して計算
  → formatter: 計算結果を日本語表示用の構造へ変換
```

`canonical name` は計算ライブラリへ渡す英語名、`calcId` はその名前から英数字だけを取り出して小文字にした照合用IDです。
例: `Thunderbolt` / `thunderbolt`。日本語表示は `displayNameJa` で扱います。

### 名前解決（resolver）

[resolver.ts](src/localization/resolver.ts) の `resolveEntity(kind, input, { allowFuzzy })` を使います。
`kind` は `pokemon` / `move` / `item` / `ability` / `nature` / `type` です。
全半角・ひらがなとカタカナ・英字の大小・空白や記号の揺れは検索用に正規化し、表示名は維持します。

| status | 意味 |
| --- | --- |
| `exact` | 日本語表示名・英語名・calcIdに一致 |
| `alias` | 登録された別名や検索語に一致 |
| `fuzzy` | `allowFuzzy: true` で部分一致の候補が1件 |
| `ambiguous` | 複数候補があり、対象を確定できない |
| `not-found` | 候補がない |

候補には英語名、ID、日本語名、出所の状態（`sourceStatus`）、一致理由が含まれます。
`sourceStatus: "supported"` は日本語表示が確認済みであることを表し、計算対応を保証しません。
翻訳対象外の既存項目は `sourceStatus: "out-of-scope"`、`localizationCategory`、`noteJa` を返し、英語名とcalcIdを保持します。
分類は翻訳範囲の情報です。技の `category`（Physical / Special / Status）や計算への受け渡しは変えません。
Web UIの計算導線は `exact` / `alias` のみを採用し、曖昧な入力から対象を自動選択しません。
例えば「ケンタロス パルデアのすがた」はウォーターしゅ・ブレイズしゅ・コンバットしゅの3候補になります。

### 計算への受け渡し（adapter）

[smogonAdapter.ts](src/calc/smogonAdapter.ts) の `calculateDamage` に、解決済みの英語名を渡します。
日本語検索やUIの状態管理はadapterの責務に含めません。現在の計算世代はGen9です。

- ポケモン: 英語名、レベル、持ち物、特性、性格、努力値、個体値、能力ランク、テラスタイプ、現在HP。
- 技: 英語名、急所、ヒット数。
- 場: 対戦形式、天候、フィールド、攻撃側・防御側の壁や補助条件。

正確な入力項目は同ファイルの `DamageCalculationInput` と各入力型を参照してください。
結果にはダメージの乱数一覧・範囲・割合、`@smogon/calc` の `kochance()` に由来する確率・ターン数・原文、計算条件の要約、検証用の `rawDescription` が含まれます。
生成JSONにある威力・タイプ・能力値などは表示・検証用の情報で、計算には使いません。

### 日本語結果表示（formatter）

[jaResultFormatter.ts](src/formatters/jaResultFormatter.ts) の `formatDamageResultJa` が、adapterの結果を表示用に変換します。
攻撃側・防御側・技・持ち物・特性・性格・場の日本語名、ダメージ範囲・割合・確定数などを返します。
日本語名がない場合は英語名を表示し、計算結果から取得できない値は補完しません。

KO英文の参考訳は [smogonKoReferenceTranslator.ts](src/formatters/smogonKoReferenceTranslator.ts) が担当します。
対応するcalc版・英文形式・効果名がすべて一致した場合だけ訳し、未知の場合は英文全体を表示します。
原文と `isAuthoritative: false` を保持する表示専用の訳であり、訳文からKO判定や計算条件を作りません。

## Showdown表示API

[src/showdown.ts](src/showdown.ts) の `resolveShowdownDisplayNameJa(kind, input)` が公開入口です。
6種別のShowdown英語名・IDを受け取り、固定版のデータから日本語表示を返します。
日本語からの逆引き・部分一致・任意の略称展開は行いません。計算用resolverとは別の契約です。

### 別のアプリへの組み込み

```bash
npm run validate:showdown-display
npm run build:showdown
```

`dist-showdown/` を組み込み先の `vendor/damage-calc-ja-layer/` などへコピーします。
`showdown.js` は外部import・実行時通信のない単独ES moduleです。型定義（`showdown.d.ts` と `types/`）、パッケージ情報、Showdownライセンス文も同梱します。
本リポジトリはprivateパッケージで、npmへは公開していません。

```js
import {
  resolveShowdownDisplayNameJa,
  showdownDisplayMetadata,
  showdownUiLabels,
} from "./vendor/damage-calc-ja-layer/showdown.js";

const speciesId = "vivillonicysnow"; // 組み込み先が保持するShowdown ID
const display = resolveShowdownDisplayNameJa("pokemon", speciesId);
const label = display.status === "localized" ? display.displayNameJa : speciesId;
// label: "ビビヨン ひょうせつのもよう"

const move = resolveShowdownDisplayNameJa("move", "hiddenpowerfire");
if (move.status === "localized") {
  const moveLabel = move.variantLabelJa
    ? `${move.displayNameJa}（${move.variantLabelJa}）`
    : move.displayNameJa;
  // moveLabel: "めざめるパワー（ほのお）"
}

console.log(showdownDisplayMetadata.showdownCommit);
console.log(showdownDisplayMetadata.summary);
const emptyMoveLabel = showdownUiLabels.noMove; // 明示的な未選択欄用の「技なし」
```

`kind` は `pokemon` / `ability` / `type` / `move` / `item` / `nature` です。
日本語名を採用する条件は `status === "localized"` に統一してください。
元のIDと対応状態も保持し、未対応や曖昧な項目は英語表示・注記・候補選択などで扱います。
`*-options.gen.json` のラベルや `sourceStatus` は補正前の情報を含むため、公開APIの結果をそれらで上書きしないでください。
`showdownUiLabels.noMove` は未選択と確定している欄に使い、未知の技の代替には使いません。

### 返却値と対応状態

| status | 意味 | 主な返却値 |
| --- | --- | --- |
| `localized` | 日本語表示が確定している | 外部名・ID、`displayNameJa`、出所、任意の補足 |
| `needs-confirmation` | 名前やフォームの対応を確認する必要がある | 外部名・ID、辞書参照、理由。日本語名は返さない |
| `unsupported` | 固定版には存在するが、日本語対応がない | 外部名・ID、理由 |
| `out-of-scope` | 翻訳対象外として分類されている | 外部名・ID、`category`、`noteJa`、理由 |
| `ambiguous` | 対象を確定できない | `candidates`、理由 |
| `not-found` | 固定版・登録別名に存在しない | 元入力、理由 |

すべての結果に `usage: "display-only"`、`kind`、元入力の `input` と正規化した `inputId` を返します。
`showdownId` / `showdownName` は外部の識別子です。`dictionaryRef` は日本語辞書の参照先であり、外部IDの置換や計算への入力には使いません。
例えば `Aegislash` は辞書の `Aegislash-Shield` を参照しても、外部IDは `aegislash` のままです。
登録別名を解決した場合は、元の `inputId` と解決先の `showdownId` が異なることがあります。

`localized` の `provenance` は `existing-dictionary`（既存辞書）または `showdown-overlay`（専用補正）です。
固定IDの識別補足は `variantLabelJa`、表示名にUI用の補足を含む項目は `labelKind: "ui-label"` と `noteJa` で区別します。
補足は現在の特性・状態を判定したものではありません。返却値の型は [showdownTypes.ts](src/localization/showdownTypes.ts)、表示データのschemaVersionは2です。

### 名前・フォームの扱い

| 対象 | 表示・解決の方針 |
| --- | --- |
| ビビヨン | 全20模様を扱う。`Vivillon` / `Vivillon-Meadow` は「はなぞののもよう」。計算用の裸の `Vivillon` は「ビビヨン」 |
| ギルガルド | `Aegislash` はシールドフォルム、`Aegislash-Blade` はブレードフォルム。calc固有の `Aegislash-Both` は表示APIでは `not-found` |
| パルデアケンタロス | 3種のIDを保持。種別のない `Tauros-Paldea` は `ambiguous` |
| 登録別名 | `Aegislash-Shield` と `Vivillon-Meadow`（各IDも可）のみ |
| 同じ日本語名の項目 | ゲッコウガ、じんばいったい、おもかげやどし、タイプ別めざめるパワーなどは、必要に応じて `variantLabelJa` で区別 |
| メガシンカ・メガストーン | 完成した名称を使い、日本語末尾のＸ・Ｙ・Ｚは全角。英語名・IDは維持し、種族名から石名を推測しない |
| ぬし・相棒 | `（ぬし）` / `（相棒）` は識別用のUI補足。`Pichu-Spiky-eared` は「ギザみみピチュー」 |
| `No Ability` | UIラベル「特性なし」。特性の無効化状態は判定しない |
| CAP・ポケウッド・MissingNo. | `out-of-scope` と分類・日本語注記を返す。CAPはSmogonの創作データ。元の英語名・IDを保持 |
| `(No Move)` / `unknown` | calc固有の項目で、この表示APIでは `not-found` |

同じ表示名を共有できるID集合は、専用補正の `sharedDisplayNameGroups` に限定します。
日本語名だけから同名項目の外部IDを一意に逆引きすることはできません。

### 固定版の対応範囲

参照するShowdown版は [3661ce40bf9001d185ce078b8920e12304204609](https://github.com/smogon/pokemon-showdown/tree/3661ce40bf9001d185ce078b8920e12304204609) です。
名前・フォーム構成・表示分類の検証に必要な情報だけを取り込み、戦闘の計算データとしては提供しません。

| 種別 | 日本語表示可能 | 要確認 | 日本語未対応 | 翻訳対象外 |
| --- | ---: | ---: | ---: | ---: |
| ポケモン・フォーム | 1,469 | 0 | 0 | 117 |
| 特性 | 318 | 0 | 0 | 3 |
| タイプ | 19 | 0 | 0 | 0 |
| 技 | 938 | 0 | 13 | 3 |
| 持ち物 | 581 | 0 | 0 | 2 |
| 性格 | 25 | 0 | 0 | 0 |

これは固定版の全項目に対する表示の集計です。ゲーム・世代別の使用可能件数や、calc未収録の件数とは異なります。
集計は `showdownDisplayMetadata.summary`、参照commitとデータ版は同metadataから取得できます。
未知の名前や将来追加されるIDは、この固定版の対応範囲に含みません。

未対応の13件は『Let's Go!』由来の次の技です。`unsupported` / `reason: "missing-japanese-mapping"` を返し、他の技への置換や推測訳は行いません。

`Baddy Bad` / `Bouncy Bubble` / `Buzzy Buzz` / `Floaty Fall` / `Freezy Frost` / `Glitzy Glow` /
`Pika Papow` / `Sappy Seed` / `Sizzly Slide` / `Sparkly Swirl` / `Splishy Splash` / `Veevee Volley` / `Zippy Zap`

## データの管理と更新

### 同梱データと補正

データは、計算用の英語カタログ、日本語辞書、手動補正、Showdown表示データに分けています。
各データの `schemaVersion`、`dataVersion`、`source`、`generatedBy`、`summary` で形式・版・出所を追えます。

日本語の `*-options.gen.json` は、ChampionCreator由来の取り込み済みスナップショットです。
元の日本語options生成スクリプトと全入力データは本リポジトリに含まれていないため、ここで一式を再生成することはできません。
表示名と検索語の補正は `ja-label-overrides.json`、入力互換の別名は `ja-aliases.json` へ記述します。
補正はlocalization層で一覧・resolver・formatterへ共通適用されます。
計算用カタログに同じID・英語名が存在する項目には、固定Showdown表示APIの確定した日本語名と翻訳分類を反映します。
例えば `Silvally-Bug` は「シルヴァディ タイプ：バグ」、`Maushold` は「イッカネズミ ３びきかぞく」、`Dragoninite` は「カイリュナイト」です。
「シルヴァディ むしタイプ」などのタイプ別表記と、メガストーンの旧表記は入力互換用の明示的な別名として受け付け、表示には現在の名称を返します。フォームを示す検索語は各IDの正しい名称に対応します。
`variantLabelJa` は計算条件の選択用に括弧で添えます。例: 「メガニャオニクス (オス)」「めざめるパワー(でんき)」。固定項目の識別用表記で、現在の特性や状態を判定しません。
calcの裸の `Vivillon` は特定模様を推定せず「ビビヨン」を維持し、calc専用の `Aegislash-Both` と `(No Move)` も既存の契約を維持します。
Showdown専用フォーム・技・特性を計算用カタログや辞書へ追加しません。calcに存在しない既存の参考項目は計算未対応のままです。
calcの英語カタログにだけ存在するCAPポケモン80件には、日本語optionsを追加しません。計算用resolverの対象外で、`validate:ja-mapping` の `catalogOnlyTranslationScope` から翻訳対象外の分類を確認できます。
日本語optionsのJSONを直接利用する場合は、`applyManualLabelOverride(kind, option)` と `getOptionDisplayNameJa(kind, option)` を適用してください。JSON単体の `label`・検索語・出所の状態には取り込み時の情報が残ります。
`confirmsShowdownName: false` の表示補正は、未確認のShowdown名を確定する根拠にはしません。

Showdown用の日本語名・辞書参照・別名・曖昧入力・分類・出典は `showdown-display-overrides.json` で管理します。
`showdown-pokemon-names.json` には `@motemen/pokemon-data@9.5.0` のPokéAPI由来の日本語欄から取り込んだ182項目と必要な元行を同梱します。
種族名とフォーム名を空白で連結する項目と、おきがえピカチュウのように完成した名前を使う項目を区別します。
この出所は、すべての名前をゲーム公式資料で個別確認したことを意味しません。
各項目の出典・確認日は専用補正に記録し、参照版は `scripts/data/showdown-source.lock.json` で固定します。

### 日本語表示の更新

1. 計算用の表示名・別名は日本語補正へ、Showdown専用の名前や分類はShowdown補正へ追加します。
2. 新しい名称は出典を記録し、対応するテストを更新します。未確認の対応は `needs-confirmation` として扱います。
3. Showdown表示データを再生成し、検証・テスト・ビルドを実行します。

```bash
npm run generate:showdown-display
npm run validate:ja-mapping
npm run validate:showdown-display
npm test
npm run build
npm run build:showdown
```

Showdown表示の通常再生成は、同梱スナップショットからオフラインで実行できます。
`validate:showdown-display` は再生成結果との完全一致、ID・別名・辞書参照、フォーム集合、共有名、翻訳と対象外分類の競合を検査します。
データ版には入力辞書・補正・表示規則のhashを反映します。
別のアプリへ渡す場合は、補正前のJSONだけではなく、公開APIまたは `dist-showdown/` を使ってください。

### 計算ライブラリの更新

依存版を変更したら、次の順でカタログを再生成し、差分を確認します。

```bash
npm run inspect:calc
npm run generate:calc-catalog
npm run validate:calc-catalog
npm run validate:ja-mapping
npm run generate:showdown-display
npm run validate:showdown-display
npm test
npm run build
npm run build:showdown
```

日本語辞書との不足・不一致、adapterの型と受け渡し、KO英文の形式・効果名も確認します。
KO参考訳は対応版を明示しており、新しい版の確認が済むまでは英文表示になります。

### 取り込み元の再検証

元の `POKEMON_ALL.json` を保有している場合は、任意の場所から同梱した日本語名の元行を照合できます。

```bash
node scripts/import-showdown-pokemon-names.mjs path/to/POKEMON_ALL.json --check
```

`--check` を外すと、登録済みのID・表示名・組み立て方法を維持したまま元行を再取り込みします。
元JSONは内容hashで固定され、別版を使う場合は対応と出所を再確認して固定情報を更新する必要があります。

Showdownの上流スナップショットを再検証する場合は、固定commitのcheckoutを別途用意します。

```bash
git -c core.autocrlf=false clone https://github.com/smogon/pokemon-showdown.git node_modules/.cache/pokemon-showdown
git -C node_modules/.cache/pokemon-showdown -c core.autocrlf=false checkout --detach 3661ce40bf9001d185ce078b8920e12304204609
node scripts/import-showdown-catalog.mjs node_modules/.cache/pokemon-showdown --check
```

上流の依存インストールや実行は不要です。抽出処理はTypeScript構文から必要な情報だけを読み、改行を含むファイルのSHA-256を照合します。
`--check` を外すと固定版のスナップショットを書き出します。
参照版を更新するときはlock・専用補正のcommit情報、フォーム構成、別名、対象外分類を一緒に見直してください。

### 画像

画像の参照元は `pokemon-options.gen.json` の `artwork` です。
対応するPNGを `public/assets/official-artwork/` に置き、UIは必要な画像を遅延読み込みします。
画像が欠ける場合は文字マークを表示します。画像を追加・変更した場合は `npm run validate:artwork-assets` で参照と実ファイルを照合してください。
画像からフォームや計算条件を推定しません。

## 検証コマンド

| コマンド | 確認する内容 |
| --- | --- |
| `npm run inspect:calc` | 計算ライブラリの版・ライセンス・主要API |
| `npm run validate:calc-catalog` | 6種別の英語カタログの形式・ID・依存版との対応 |
| `npm run validate:ja-mapping` | 日本語辞書と補正の構造、重複、空欄、カタログとの差分、補正後の状態・翻訳分類 |
| `npm run validate:artwork-assets` | 画像参照の不正・欠落と未使用画像 |
| `npm run validate:showdown-display` | 同梱入力からのShowdown表示再生成との一致・対応の整合性 |
| `npm test` / `npm run test:watch` | 単体テストの一括実行 / 変更監視 |
| `npm run build` | Web UIの型検査とビルド |
| `npm run build:showdown` | 表示APIの単独JS・型定義・ライセンスの出力 |

公開前には4つの `validate:*`、テスト、両方のビルドを実行します。
検証のsummaryやwarningには、未対応・暫定データ・英語表示などが含まれます。成功終了だけで全項目の日本語対応や計算対応を判断しないでください。

## GitHub Pagesへの公開

[.github/workflows/deploy.yml](.github/workflows/deploy.yml) が、`main` へのpushまたは手動実行で動きます。
`npm ci`、各検証、テスト、Web UIと表示APIのビルドを実行し、`dist/` をGitHub Pagesへ公開します。
`dist-showdown/` は別アプリへの組み込み用出力で、Pagesの公開対象には含みません。

GitHub側の設定は `Repository settings → Pages → Source → GitHub Actions` です。
Viteの `base: "./"` により、リポジトリ名を含むパスでもJS・CSS・画像を相対パスで読み込めます。

## 対応範囲と制限

- 計算世代はGen9、同梱カタログの計算ライブラリ版は `@smogon/calc@0.11.0` です。特定ゲームの使用可能な項目だけに絞った一覧ではありません。
- 暫定名や未確認名は辞書の `sourceStatus` と検証summaryで区別します。`Type` の `unknown → ???` はcalc側の空IDと対応する特殊項目で、検証warningとして残ります。
- `Eelevate` / `Aura Guard` / `Fire Mane` など、calc未収録の特性は表示APIで名前を取得できてもadapterでは計算できません。
- 計算用のビビヨンは `Vivillon` / `Vivillon-Fancy` / `Vivillon-Pokeball` の3項目です。Showdownの全20模様対応とは分けて扱います。
- Web UIと条件JSONは、adapterが扱える入力の一部を提供します。詳細条件はadapterの入力型を参照してください。
- KO英文の参考訳は確認済みの `@smogon/calc@0.11.0` の英文形式に限ります。未知の版・形式・効果は英文表示になります。
- 日本語辞書の完全な再生成には、別途元の生成スクリプトと入力データが必要です。同梱の補正による表示更新とShowdown表示再生成は本リポジトリ内で行えます。
- 生成データを静的に読み込むため、ビルドで大きなJSファイルに関するwarningが出る場合があります。画像も公開物の容量に含まれます。
