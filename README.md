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
- 外部 Pokemon Showdown のポケモン・フォーム・特性・タイプの名前/IDから、日本語表示を取得する（計算用resolverとは別API）
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
npm run validate:showdown-display
npm run inspect:calc
npm test
npm run build
npm run build:showdown
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
- `src/showdown.ts`: 外部Showdown名/ID -> 日本語表示の公開入口
- `src/calc/smogonAdapter.ts`: `@smogon/calc` 呼び出し境界
- `src/formatters/jaResultFormatter.ts`: calc 結果の日本語表示用 formatter
- `src/formatters/smogonKoReferenceTranslator.ts`: KO英文 `sourceText` の表示専用参考translator
- `src/domain/shareState.ts`: 計算条件 JSON の schemaVersion / serialize / parse
- `src/data/generated/*.gen.json`: 日本語 options JSON
- `src/data/generated/calc-*.gen.json`: `@smogon/calc` Gen9 由来の canonical catalog
- `src/data/overrides/`: 日本語 alias / 表示名補正の manual overlay
- `src/data/overrides/smogon-ko-reference-ja.json`: `@smogon/calc@0.11.0` KO英文の参考訳辞書
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

KO chance の英文 `sourceText` だけは、`src/formatters/smogonKoReferenceTranslator.ts` の独立した表示専用translatorへ渡す。
この参考訳は計算やKO判定へ再利用せず、対応するcalc version・英文template・全effectが一致した場合だけ日本語を返す。未知version・未知template・未知effectでは部分翻訳せず、英文全体へfallbackする。

返す主な表示情報:

- 攻撃側、防御側、技の日本語表示名と canonical name
- 持ち物、特性、性格、テラスタイプの日本語表示名と canonical name
- ダメージ最小 / 最大、乱数 roll、割合表示
- `@smogon/calc` の `kochance()` 由来の KO chance 構造値と原文 source
- `@smogon/calc@0.11.0` のKO英文に対する「Smogon原文の参考翻訳」と翻訳status
- 天候、フィールド、壁や場条件の日本語ラベル
- 検証用の `rawDescription` / `sourceDescription`

日本語名が見つからない場合は canonical name を fallback 表示する。
確定数、乱数表現、割合などは adapter が `@smogon/calc` から安全に渡せる範囲だけ表示し、取れない情報を formatter 側で仮補完しない。
参考翻訳は常に原文と `isAuthoritative: false` を保持し、日本語表示が計算の正ではないことをAPI上でも区別する。

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

日本語 options は取り込み済みスナップショットで、この checkout には元の
`generate-pokemon-options.mjs` / `generate-battle-options.mjs` と全入力素材は含まれていない。
表示補正は `ja-label-overrides.json` を `displayNameRules.ts` で実行時に適用し、一覧・resolver・formatter で共有する。
メガシンカ97項目は、重複する通常種名を除いた完成名で表示する（例: `メガアブソル` / `メガプテラ`）。
X・Y・Zの表記と `メガメガニウム` はそのまま保持する。
旧表示の `アブソル メガアブソル` などは `ja-aliases.json` で入力互換用の別名として受け付け、返す表示は完成名へ統一する。
`confirmsShowdownName: false` を指定した表示補正は、Showdown側の未確認フォームを承認済みへ変更しない。
補正対象の検索文字列も補正後の表示名・canonical name・IDから組み直し、誤った旧表示を検索に残さない。
残す必要がある旧入力や略称は `ja-aliases.json` に明示する。
この補正の反映に options JSON の手編集・再生成は不要で、通常の test / build で再現できる。
別プロジェクトで使う場合も、補正前の generated JSON だけをコピーせず、補正定義と localization 層を一緒に使う。

### 既存 calc フォームの日本語表示

| calc canonical name | 日本語表示 |
| --- | --- |
| Tauros-Paldea-Aqua | ケンタロス パルデアのすがた・ウォーターしゅ |
| Tauros-Paldea-Blaze | ケンタロス パルデアのすがた・ブレイズしゅ |
| Tauros-Paldea-Combat | ケンタロス パルデアのすがた・コンバットしゅ |
| Vivillon | ビビヨン |
| Vivillon-Fancy | ビビヨン ファンシーなもよう |
| Vivillon-Pokeball | ビビヨン ボールのもよう |

日本語名の確認元は、[ポケモンずかんのケンタロス](https://zukan.pokemon.co.jp/detail/0128)と
[ポケモン公式のビビヨン模様一覧](https://www.pokemon.co.jp/goods/2025/05/250530_go01.html)。
名前とフォームの間を空白で区切る既存方針に沿い、ケンタロスの種別は公式の「しゅ」表記を使う。
「ケンタロス ウォーター種」などの漢字表記も別名として解決する。
「ケンタロス パルデアのすがた」「パルデアケンタロス」は3候補の `ambiguous` となり、種類を自動選択しない。

`@smogon/calc@0.11.0` の `src/data/species.ts` と `Generations.get(9).species` では、
裸の `Vivillon` は `otherFormes` に Fancy / Pokeball を持つ基本項目で、特定の模様を示す情報はない。
そのため本レイヤーでは模様を指定しない「ビビヨン」として扱い、Showdown の既定模様や画像から模様を推定しない。
3項目のタイプ・種族値・体重・既定特性は同一だが、canonical name はそれぞれ維持する。
「はなぞののもよう」を Fancy / Pokeball に流用する理由にはならないため、その旧検索語は引き継がない。
calc 向け辞書には残りの模様を追加しない。外部Showdown向けは後述の独立APIで全20模様を扱う。
画像参照は既存のままであり、模様を識別する根拠には使わない。

`Eelevate` / `Aura Guard` / `Fire Mane` は採用中の `@smogon/calc@0.11.0` の特性一覧・効果実装、
本レイヤーの calc catalog / 日本語 options に未収録。
resolver は `not-found`、表示は英語 fallback、adapter は未知の特性として拒否する。
計算用カタログ・resolverには追加しない。日本語表示は後述のShowdown表示専用APIで扱う。
`Aegislash-Shield` / `Aegislash-Blade` / `Aegislash-Both` も calc 固有の別項目として維持する。

## 外部Showdown向け日本語表示API

公開入口は `src/showdown.ts` の `resolveShowdownDisplayNameJa(kind, input)`。
`kind` は `pokemon` / `ability` / `type`、`input` はShowdown名またはID。
`resolveEntity` / `getDisplayNameJa`、calc catalog、adapterとは独立しており、表示に成功しても計算可能とは判定しない。
日本語名の検索、部分一致、任意のShowdown略称の展開は行わない。

```ts
import { resolveShowdownDisplayNameJa, showdownDisplayMetadata } from "./src/showdown";

const result = resolveShowdownDisplayNameJa("pokemon", "aegislash");
// {
//   input: "aegislash", inputId: "aegislash", kind: "pokemon",
//   usage: "display-only", status: "localized", matchedBy: "name-or-id",
//   showdownId: "aegislash", showdownName: "Aegislash",
//   displayNameJa: "ギルガルド シールドフォルム",
//   dictionaryRef: { kind: "pokemon", id: "aegislashshield", canonicalName: "Aegislash-Shield" },
//   provenance: "showdown-overlay"
// }
console.log(showdownDisplayMetadata.showdownCommit);
```

`input` と `inputId` は元入力とそのShowdown式ID化を保持する。
`showdownId` / `showdownName` は参照版に存在する外部の識別子、`dictionaryRef` は日本語辞書を引くためだけの参照先。
`dictionaryRef` を外部IDの置換やcalcへの入力に使用しない。
明示的な別名の場合だけ、元の `inputId` と解決先の `showdownId` が異なる。
返却形式はTypeScriptの判別可能なunionとして公開している。

| status | 内容 | 日本語名 |
| --- | --- | --- |
| `localized` | 名前/IDまたは確認済み別名に一致 | `displayNameJa` を返す |
| `needs-confirmation` | 辞書の暫定名、通常種へのfallback、区別できないフォーム表示など | 返さない。外部ID・辞書参照・`reason`を返す |
| `unsupported` | 参照版に存在するが、日本語対応がない | 返さない。外部ID・`reason`を返す |
| `out-of-scope` | 翻訳対象外として確認済み | 返さない。元の名前・ID、`category`・`noteJa`・`reason`を返す |
| `ambiguous` | 種別未指定などで表示対象を確定できない | 選択結果を返さず、`candidates` と `reason`を返す |
| `not-found` | 参照版または許可した別名に存在しない | 返さない。元入力と `reason`を返す |

`localized` の `provenance` は既存辞書の再利用 (`existing-dictionary`) または明示的な補正 (`showdown-overlay`)。
`displayNameJa` 自体にUI用の補足を含む相棒・ぬし・特殊項目には `labelKind: "ui-label"` と `noteJa` を付ける。
確認済みの同名項目には、名前と分離した任意の `variantLabelJa` を返す。
これは固定Showdown IDを区別するためのUI補足で、現在の特性・状態や使用可否を判定した結果ではない。
`out-of-scope` の追加に伴い、生成済み表示mappingと `showdownDisplayMetadata.schemaVersion` は **2**。
statusを列挙して処理する呼び出し側は新状態を追加する。`status === "localized"` の場合だけ日本語名を使う処理はそのまま使える。
全結果の `usage: "display-only"` は計算対応・ゲーム内使用可否を保証しないことを表す。
`unknown -> ???` はcalc側の特殊項目であり、このAPIのタイプには含めない。

### SnapCropへの取り込み例

```bash
npm run validate:showdown-display
npm run build:showdown
```

`dist-showdown/showdown.js` は外部import・実行時通信がない単独ES module。
出力フォルダーをSnapCrop側の `vendor/damage-calc-ja-layer/` などへコピーして使える。
型定義 (`showdown.d.ts` と `types/`) とShowdownのライセンス文も同梱される。
本リポジトリはprivateパッケージであり、npm公開は行っていない。

```js
import { resolveShowdownDisplayNameJa } from "./vendor/damage-calc-ja-layer/showdown.js";

const speciesId = "vivillonicysnow"; // SnapCropがShowdownから受け取ったID
const display = resolveShowdownDisplayNameJa("pokemon", speciesId);
const label = display.status === "localized" ? display.displayNameJa : speciesId;
// label: "ビビヨン ひょうせつのもよう"
// 元のspeciesIdを保存し、要確認・未対応・対象外・曖昧などはdisplay.statusで別途表示する。

const ability = resolveShowdownDisplayNameJa("ability", "Aura Guard");
const type = resolveShowdownDisplayNameJa("type", "electric");
// ability.displayNameJa: "はどうのぼうご"（status === "localized" の場合）
// type.displayNameJa: "でんき"（同上）
```

### 同じ日本語名を共有するID

正確な名前/IDで項目が決まる場合、表示名が他のIDと同じでも `localized` を返す。
選択・保存のキーは `showdownId` とし、日本語名で別IDをまとめたり、特性名からIDを推測したりしない。

| Showdown項目 | displayNameJa | variantLabelJa |
| --- | --- | --- |
| Greninja-Bond | ゲッコウガ | きずなへんげ |
| Rockruff-Dusk | イワンコ | マイペース |
| Ogerpon各種-Tera | オーガポン＋各お面の名称 | テラスタル |
| Meowstic-M-Mega / Meowstic-F-Mega | メガニャオニクス | オス / メス |
| As One (Glastrier) / As One (Spectrier) | じんばいったい | ブリザポス / レイスポス |
| Embody Aspect各種 | おもかげやどし | 各お面の名称 |

通常のGreninja / Rockruff / テラスタル前Ogerponには補足を付けない。
メガニャオニクスは日本語名が共通でも、固定Showdown上の雌雄IDは保持する。
既存calc向けの日本語resolverの契約はそのままであり、同名の日本語だけから外部IDを逆引きする機能は提供しない。

```ts
const result = resolveShowdownDisplayNameJa("pokemon", "greninjabond");
if (result.status === "localized") {
  const compactLabel = result.displayNameJa; // ゲッコウガ
  const detailedLabel = result.variantLabelJa
    ? `${result.displayNameJa}（${result.variantLabelJa}）`
    : result.displayNameJa; // ゲッコウガ（きずなへんげ）
  const selectedId = result.showdownId; // greninjabond を保持
}
```

同名の承認は出典付きの `sharedDisplayNameGroups` 9群に限定する。
生成時に名前・kind・ID集合・補足の区別を照合し、未知の第三項目の混入や補足の重複を拒否する。
未確認の同名フォームを許可するために重複検査全体を無効化することはしない。

### 参照版と対応範囲

Showdown参照版は [3661ce40bf9001d185ce078b8920e12304204609](https://github.com/smogon/pokemon-showdown/tree/3661ce40bf9001d185ce078b8920e12304204609)
（commit日時: 2026-10-02 UTC、確認日: 2026-10-04）。
`data/pokedex.ts`、`data/abilities.ts`、`data/typechart.ts`、`data/aliases.ts`、`sim/dex-species.ts`を確認した。
スナップショットは名前とフォーム構成のみを採用し、タイプ相性・能力値・特性効果は取り込まない。

| 種別 | 日本語表示可能 | 要確認 | 日本語未対応 | 翻訳対象外・確認済み | 参照版の項目数 |
| --- | ---: | ---: | ---: | ---: | ---: |
| ポケモン・フォーム | 1,469 | 0 | 0 | 117 | 1,586 |
| 特性 | 318 | 0 | 0 | 3 | 321 |
| タイプ | 19 | 0 | 0 | 0 | 19 |

件数は参照版の全項目（CAP等を含む）に対する表示の集計であり、ゲーム・世代別の使用可能件数ではない。
最新の集計は `showdownDisplayMetadata.summary` で取得できる。
未解決は `needs-confirmation` + `unsupported` の合計。`out-of-scope` は含めない。
この件数はcalc未収録の項目数や新規翻訳が必要な件数とは異なる。
元辞書の暫定フラグだけでは自動承認せず、名前と対応を確認した項目をShowdown専用補正で確定する。
この固定版では翻訳対象の1,806件に対応し、要確認・日本語未対応は0件。
別枠の120件は翻訳対象外として確認済み。未知の名前や将来追加されるIDまで対応済みという意味ではない。
日本語名・補足の出典は `showdown-display-overrides.json` の各項目と共有名グループに記録している。

### POKEMON_ALLから採用した日本語名

`@motemen/pokemon-data@9.5.0` の提供スナップショットから、ユーザーが採用を承認した182項目を
`src/data/overrides/showdown-pokemon-names.json` に取り込んでいる。
通常の生成・ビルド・テストにはこの同梱ファイルを使い、`others/` や外部APIには依存しない。

- 171項目: 日本語の種族名とフォーム名を空白で連結。
- 2項目: `Minior-Meteor` の7行と `Zygarde` の2行は各々すべて同じ表示を返すことを確認し、外部IDごとに一意の表示を採用。
- 3項目: `Frillish` / `Jellicent` / `Pyroar` はフォーム指定のない名前として、`プルリル` / `ブルンゲル` / `カエンジシ` を表示。
- 6項目: おきがえピカチュウは完成したフォーム名をそのまま表示し、種族名を二重に付けない。

| Showdown名 | 表示例 |
| --- | --- |
| Silvally-Bug | シルヴァディ タイプ：バグ |
| Maushold / Maushold-Four | イッカネズミ ３びきかぞく / イッカネズミ ４ひきかぞく |
| Minior | メテノ あかいろのコア |
| Pikachu-Belle | マダム・ピカチュウ |
| Pikachu-Cosplay | おきがえピカチュウ |
| Pikachu-Libre | マスクド・ピカチュウ |
| Pikachu-PhD | ドクター・ピカチュウ |
| Pikachu-Pop-Star | アイドル・ピカチュウ |
| Pikachu-Rock-Star | ハードロック・ピカチュウ |

日本語名は提供されたPokéAPI由来の欄を採用したもので、ゲーム公式資料で新規確認したことは意味しない。
シルヴァディの `タイプ：バグ` / `タイプ：ウオーター` なども、承認された元の表記を保持する。
既存calc向けの `getDisplayNameJa` / resolver / formatter の表示契約は変更しない。
日本語表示に対応しても、calcにない個別フォームが計算可能になったとは判定しない。

### ぬし・特殊項目の表示方針

ユーザーが2026-10-04に確認したShowdownの説明と採用方針を、版を固定した専用補正へ記録している。
実行時に説明文の解析や接尾辞の削除で対象を推測せず、登録済みのIDだけに適用する。

- ぬしの通常種名8件: `Araquanid-Totem` / `Gumshoos-Totem` / `Kommo-o-Totem` / `Lurantis-Totem` / `Ribombee-Totem` / `Salazzle-Totem` / `Togedemaru-Totem` / `Vikavolt-Totem`。
  既存の種族名に `（ぬし）` を付ける。外部IDはTotemのまま。括弧部分は正式種族名ではなく識別用のUI表記。
- 地域・状態付きのぬし4件: `ガラガラ アローラのすがた（ぬし）` / `ラッタ アローラのすがた（ぬし）` / `ミミッキュ ばけたすがた（ぬし）` / `ミミッキュ ばれたすがた（ぬし）` と表示する。
- `Pikachu-Starter` / `Eevee-Starter`: `ピカチュウ（相棒）` / `イーブイ（相棒）`。括弧部分はUI補足。
- `Pichu-Spiky-eared`: 公式の名称 `ギザみみピチュー` を表示する。
- `No Ability` / `noability`: `特性なし` を返す。正式な特性名の翻訳ではなくUI用ラベル。特性の無効化状態を判定するものではない。
- CAP86件: `category: "cap"`。元の英語名に加えて「Smogon CAPの創作ポケモン」または「Smogon CAPの創作特性」を `noteJa` に返す。
- ポケウッド33件: `category: "pokestar"`、`noteJa: "ポケウッドの登場データ"`。公式ゲーム由来の特殊データとしてCAPと区別する。日本語名が存在しないと断定せず、今回は個別名称の翻訳対象外とする。
- `MissingNo.`: `category: "glitch"`、`noteJa: "初代作品のバグ由来データ"`。元の表記を維持する。

最後の3分類は `status: "out-of-scope"`、`reason: "outside-localization-scope"` として既知の項目を返す。
APIから削除したり、呼び出し側で非表示にすると決めたりはしない。日本語の固有名は返さず、英語名と注記を表示できる。

```ts
const display = resolveShowdownDisplayNameJa("pokemon", "Ababo");
if (display.status === "out-of-scope") {
  console.log(display.showdownId);   // ababo
  console.log(display.showdownName); // Ababo
  console.log(display.category);     // cap
  console.log(display.noteJa);       // Smogon CAPの創作ポケモン
}
```

### 名前が異なる項目と確認済み別名

- `Aegislash` / `aegislash`: シールドフォルム。辞書の `Aegislash-Shield` を参照しても外部IDは `aegislash`。
- `Aegislash-Blade`: ブレードフォルムを維持。`Aegislash-Both` はこの入口では `not-found`。
- `Tauros-Paldea-Aqua` / `Blaze` / `Combat`: 既存補正辞書のウォーターしゅ・ブレイズしゅ・コンバットしゅを再利用。
- `Tauros-Paldea`: `ambiguous`。Showdownの略称はCombatへのaliasだが、このAPIでは3種から選ぶ必要がある入力として明示する。
- 確認済み別名は `Aegislash-Shield` / `aegislashshield` と `Vivillon-Meadow` / `vivillonmeadow` のみ。その他の略称は展開しない。

### ビビヨン全20模様

参照版の `formeOrder` 20件を、裸の `Vivillon` + `cosmeticFormes` 17件 + `otherFormes` 2件と突合する。
`baseForme: "Meadow"` と `vivillonmeadow: "Vivillon"` に基づき、裸の `Vivillon` は「はなぞののもよう」と表示する。
上流コメントの「実際のbaseはIcy Snow」というTODOは未適用であり、定義の置換には使わない。
`dex-species.ts` がcosmetic formを保持する処理に合わせ、各模様から `Vivillon` へのaliasをそのまま適用して模様を消すことはしない。
calc側の裸の `Vivillon` は従来どおり「ビビヨン」であり、契約は変えない。

| Showdown名（各IDも受付） | 表示する模様 |
| --- | --- |
| Vivillon-Icy Snow | ひょうせつのもよう |
| Vivillon-Polar | せつげんのもよう |
| Vivillon-Tundra | ゆきぐにのもよう |
| Vivillon-Continental | たいりくのもよう |
| Vivillon-Garden | ていえんのもよう |
| Vivillon-Elegant | みやびなもよう |
| Vivillon / Vivillon-Meadow | はなぞののもよう |
| Vivillon-Modern | モダンなもよう |
| Vivillon-Marine | マリンのもよう |
| Vivillon-Archipelago | ぐんとうのもよう |
| Vivillon-High Plains | こうやのもよう |
| Vivillon-Sandstorm | さじんのもよう |
| Vivillon-River | たいがのもよう |
| Vivillon-Monsoon | スコールのもよう |
| Vivillon-Savanna | サバンナのもよう |
| Vivillon-Sun | たいようのもよう |
| Vivillon-Ocean | オーシャンのもよう |
| Vivillon-Jungle | ジャングルのもよう |
| Vivillon-Fancy | ファンシーなもよう |
| Vivillon-Pokeball | ボールのもよう |

表示には「ビビヨン 」を付ける。日本語20模様の表記は[公式の全20種ピンズ紹介](https://www.pokemon.co.jp/goods/2025/05/250530_go01.html)で確認。
未知の模様名は他模様へ置換せず `not-found` とする。

### 新特性の確認元

英語名とIDは参照版の `data/abilities.ts` の `name` とオブジェクトキー。
日本語名は下記公式図鑑のページ内 `script#json-data` の `abilities[].name` を2026-10-04に確認した。

| Showdown名 | ID | 正式な日本語名 | 確認元 |
| --- | --- | --- | --- |
| Eelevate | eelevate | うなぎのぼり | [メガシビルドン](https://zukan.pokemon.co.jp/detail/0604-1) |
| Aura Guard | auraguard | はどうのぼうご | [メガルカリオＺ](https://zukan.pokemon.co.jp/detail/0448-2) |
| Fire Mane | firemane | ほのおのたてがみ | [メガカエンジシ](https://zukan.pokemon.co.jp/detail/0668-2) |

これらはShowdown表示専用の手動対応表に収録し、未収録のcalc catalogや日本語optionsには追加しない。
特性の効果・所属・通常/隠れ/特殊の表示選択は本APIの責務に含めない。

### 再生成と更新

- `scripts/data/showdown-source.lock.json`: 上流commit・確認日・採用ファイルのSHA-256。
- `src/data/generated/showdown-catalog.gen.json`: 上流から抽出した名前・フォーム構成・別名の監査用スナップショット。
- `src/data/overrides/showdown-display-overrides.json`: 出典付きの翻訳参照先・追加日本語名・確認済み別名・曖昧入力。
- 同ファイルの `outOfScopeGroups`: 確認済みの翻訳対象外ID・分類・日本語注記・判断根拠。
- 同ファイルの `sharedDisplayNameGroups`: 同じ日本語名を返してよい、確認済みのID集合と出典。識別補足は各entryの `variantLabelJa`。
- `src/data/overrides/showdown-pokemon-names.json`: 採用済み182項目の外部ID・承認表示名・組立方法と元データ189行の必要フィールド。元JSONの内容hash・出所・採用日を保持。
- `src/data/generated/showdown-display.gen.json`: 既存辞書と補正から生成する対応・未対応の一覧。単体では辞書参照が未展開なので、外部利用には公開入口またはビルド済みJSを使う。

日常の再生成は同梱スナップショットからオフラインで実行できる。

```bash
npm run generate:showdown-display
npm run validate:showdown-display
npm test
npm run build:showdown
```

`validate:showdown-display` は元データから組み直して生成結果の完全一致を確認し、
ID重複・存在しない辞書参照・別名衝突・上流別名の不一致・ビビヨン全模様の欠落・翻訳と対象外定義の競合・承認していない表示名共有も拒否する。
採用済みポケモン名も、元行の名前/ID・組立方法・複数行の一致を確認する。別フォームへの置換や、複数候補の先頭だけを採る処理はしない。
生成データのversionには入力辞書・補正・表示規則のhashを反映する。
ローカルJSONは内容を正規化し、表示規則は改行をLFへ揃えてhash化するため、Windows/Linuxで同じ結果になる。

提供元の `POKEMON_ALL.json` を保有している場合は、次の任意コマンドで採用部分を再検証できる。
`--check` を外すと承認済みのID・表示名・組立方法を維持したまま元行を再取り込みする。

```bash
node scripts/import-showdown-pokemon-names.mjs path/to/POKEMON_ALL.json --check
```

元JSONは改行・空白に依存しない内容hashで固定し、別版への更新は承認済み一覧を再確認してから行う。
通常の `generate:showdown-display` には元JSONも作業用の調査一覧も不要。

上流スナップショット自体を再検証する場合は、固定版のShowdown checkoutを用意する。
Showdownの依存インストールや実行は不要。抽出scriptはTypeScript構文から名前用のリテラルだけを読み、上流コードを実行しない。

```bash
git -c core.autocrlf=false clone https://github.com/smogon/pokemon-showdown.git node_modules/.cache/pokemon-showdown
git -C node_modules/.cache/pokemon-showdown -c core.autocrlf=false checkout --detach 3661ce40bf9001d185ce078b8920e12304204609
node scripts/import-showdown-catalog.mjs node_modules/.cache/pokemon-showdown --check
```

`--check` を外すとスナップショットを再生成する。改行を含めてSHA-256で固定元と照合する。
Showdown版を更新するときはlockと対応表のcommitを更新し、`baseForme` / 全フォーム / 別名を再監査してから再生成する。
既存辞書の暫定名を確認できた場合も、根拠と明示的な参照をShowdown補正へ追加する。
タイプ・特性・種族値の継承、ゲーム別使用可否、画像、SnapCrop本体はこの機能の対象外。

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

calc version を更新した場合は、`smogon-ko-reference-ja.json` の全effect、KO英文template fixture、translatorの対応profileも同時に確認する。確認が終わるまでは、新versionの `sourceText` は英文fallbackとして扱う。

画像参照を増やした場合は `public/assets/official-artwork/` と `src/data/generated/pokemon-options.gen.json` の `artwork` を揃え、`npm run validate:artwork-assets` を通す。

## 制限

- `Generations.get(9)` は National Dex 的に広い catalog を返すため、CAP や暫定データは validation summary / `sourceStatus` で可視化する
- Champions 新特性 4 件は `needs-confirmation` として扱い、`@smogon/calc` に存在しないものは adapter で計算しない
- Type `unknown -> ???` は calc catalog の empty id と対応するため、`validate:ja-mapping` では warning として残す
- generated JSON を静的 import しているため、build の large chunk warning は残る
- KO chance の参考訳はnpm公開版 `@smogon/calc@0.11.0` の確認済み英文templateに限定し、未知version・未知文法は英文fallbackになる
