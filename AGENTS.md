# 開発ルール

## 目的と基本原則

このプロジェクトは、`@smogon/calc` の外側で日本語入力・日本語表示を扱うレイヤーである。
日本語名の解決、計算への受け渡し、結果表示、未解決・曖昧・暫定状態の確認しやすさを優先する。
外部Pokemon Showdown名・IDの表示APIは、計算用の名前解決と独立して保守する。

- ダメージ計算・タイプ相性・乱数・技威力・特性や持ち物の補正は `@smogon/calc` を唯一の正とする。独自の計算式を実装しない。
- `@smogon/calc` は外部依存として扱い、ソース・データ・インストール済みファイルを直接変更しない。forkやvendoringを前提にしない。
- 日本語名、検索データ、画像、参考訳を計算の根拠にしない。
- 静的ホストで動作する構成を維持し、実行時の外部API・scraping・サーバーへの依存を追加しない。
- Git追跡ファイルに個人情報、ローカルの絶対パス、認証情報、秘密情報を入れない。

使い方、構成図、現在の対応範囲、開発コマンドは [README.md](README.md) を参照する。
現在の実装・型・テスト・依存版を正とし、進捗ログの古い記述から現行仕様を推定しない。

## 作業の進め方

1. `git status`、関連コード・型・テスト、README、`PROGRESS.md` の現在の状態を確認する。既存の変更を上書きしない。
2. 変更対象を担当する層に限定し、既存の構成と公開APIの契約を優先する。大きな設計変更の前に影響範囲と代替案を短く説明する。
3. 実装・必要な検証・説明の更新まで進める。重要な判断が不要な範囲では、確認待ちで止まらない。
4. 結果、実行した検証、残る制限を報告し、意味のある完了・引き継ぎを進捗ログへ記録する。

## 層ごとの責務

| 場所 | 責務 | 境界 |
| --- | --- | --- |
| `src/localization/normalizeJa.ts` | 日本語・英語の検索用正規化とID化 | 表示名を書き換えるために使わない |
| `src/localization/resolver.ts` | 種別ごとの入力から計算用英語名と候補を返す | 計算を呼ばず、曖昧な候補を自動選択しない |
| `src/localization/displayNameRules.ts` | 表示補正・フォーム名と検索用表示の共通処理 | 計算条件や計算対応を推定しない |
| `src/calc/smogonAdapter.ts` | 解決済み英語名を `Pokemon` / `Move` / `Field` / `calculate` へ渡し、結果を構造化する | 日本語検索・UI state・独自計算式を持たない |
| `src/formatters/` | adapterの結果を日本語表示へ変換する | `@smogon/calc` を直接呼ばず、訳文から計算ロジックを作らない |
| `src/domain/shareState.ts` | 計算条件JSONの形式・読み書き・検証 | UIの状態管理と混ぜず、互換性を扱う |
| `src/showdown.ts` / `src/localization/showdown*.ts` | 外部Showdown名・IDの表示専用APIと型 | 計算用resolverの別名やカタログを拡張しない |
| `src/App.tsx` / `src/style.css` | 入力、候補選択、状態表示、結果表示 | 検索アルゴリズムや計算処理を直書きせず、担当層を呼ぶ |
| `scripts/` | データの取り込み・生成・検証・配布物の整備 | 調査用データを実行時の依存にしない |

計算ライブラリの型・option shape・結果形式の変更は、adapterへ閉じ込める。
adapterへ渡す値は解決済みのcanonical nameと明示的な条件とし、表示JSONの威力・タイプ・能力値から最終結果を作らない。
追加の入力・overrideは、まず上流のAPIと型で表現できるか確認する。未対応仕様を独自に仮計算しない。

## 名前解決と表示の契約

### 計算用の名前解決

- `kind` を必須とし、Pokemon / Move / Item / Ability / Nature / Typeを混ぜない。
- `canonical name` は計算用の英語名、`calcId` はその照合用ID、`displayNameJa` は日本語表示名として区別する。日本語入力からIDを作って計算に渡さない。
- 正規化は全半角・かな・大小文字・記号などの検索補助に限定し、正式表示は保つ。
- `exact` / `alias` / `fuzzy` / `ambiguous` / `not-found` を明示し、一致理由と候補を保持する。
- `ambiguous` と `not-found` を握りつぶさない。Web UIの計算導線は `exact` / `alias` のみを採用し、`fuzzy` は候補確認に留める。
- 旧入力を受け付ける場合は `ja-aliases.json` へ明示し、誤った表示名を検索のためだけに残さない。

### 計算結果の日本語表示

- formatterはadapterが返す構造値から表示を作り、取得できない確率・確定数などを仮補完しない。
- `rawDescription` は検証用の原文として保持し、計算や名前解決のために再パースしない。
- KO英文 `sourceText` の参考訳だけは、独立した表示専用translatorで扱う。対応calc版・英文形式・全効果が一致する場合に限って訳す。
- 未知の版・形式・効果は英文全体へfallbackし、部分翻訳で確定した説明のように見せない。
- 参考訳は原文と `isAuthoritative: false` を保持し、訳文をKO判定や計算へ再利用しない。

### 外部Showdownの表示

- 公開入口は `src/showdown.ts`。英語名・IDからの表示専用APIとし、日本語逆引きや任意の別名展開を追加しない。
- `usage: "display-only"` を保持し、日本語表示への対応を計算対応・ゲーム別使用可否と扱わない。
- 元入力 `input` / `inputId`、外部識別子 `showdownId` / `showdownName`、日本語辞書参照 `dictionaryRef` を分離する。辞書参照先で外部IDを置換しない。
- `localized` / `needs-confirmation` / `unsupported` / `out-of-scope` / `ambiguous` / `not-found` を維持する。未確認・未対応の項目へ推測名を返さない。
- 共有日本語名は出典付きの `sharedDisplayNameGroups` のID集合に限定する。識別補足は `variantLabelJa` として分離し、重複検査全体を無効化しない。
- UI補足は `labelKind` / `noteJa` で区別する。固定IDの補足から現在の特性・状態を判定しない。
- CAP・ポケウッド・バグ由来データは専用分類と注記を保持し、APIから勝手に削除しない。
- 元optionsの `sourceStatus` や補正前ラベルで公開APIの確定結果を上書きしない。
- 計算側とShowdown側で異なる名前・フォームの契約を維持する。共通化する前に両方のテストを確認する。

## データと生成物

### 変更先の選択

- `src/data/generated/calc-*.gen.json`: `@smogon/calc` から生成する英語カタログ。
- `src/data/generated/*-options.gen.json`: 日本語名・検索語・画像参照の取り込み済みスナップショット。
- `src/data/overrides/ja-aliases.json` / `ja-label-overrides.json`: 計算用の別名・表示補正。
- `src/data/generated/showdown-catalog.gen.json`: 固定Showdown版から抽出した名前・フォーム・分類情報。
- `src/data/overrides/showdown-*.json`: Showdown表示の日本語名・参照・分類・出典と、取り込んだ元行。
- `src/data/generated/showdown-display.gen.json`: 同梱辞書・補正から生成する表示対応表。
- `src/data/overrides/smogon-ko-reference-ja.json`: 対応calc版のKO英文参考訳辞書。

生成済みJSONは手で直さず、補正定義または生成・取り込み処理を変更する。
日本語optionsは元の生成処理と全入力が同梱されていないため、ここで再生成できると説明しない。
表示補正はlocalization層から一覧・resolver・formatterへ共通適用し、APIごとの独自ラベル置換を増やさない。
表示だけの補正でShowdown名を確定しない場合は `confirmsShowdownName: false` を使う。

### 出所・版・再現性

- データの形式・版・出所・生成処理・集計を追えるmetadataを保持する。既存の型を参照し、初期案のschemaへ置き換えない。
- 未確認、暫定、英語fallback、対象外の状態と理由を消さず、検証summaryから確認できるようにする。
- 新しい日本語名は対応する英語名・ID・フォーム・出典を確認する。複数元行がある場合は一致を検証し、先頭行だけを採用しない。
- Showdown参照版は `scripts/data/showdown-source.lock.json` のcommitとファイルhashで固定する。上流コードを実行せず、名前用の情報だけを抽出する。
- 通常の生成・検証・テスト・ビルドは追跡済みの入力だけで再現する。元データの再検証は明示的なパスを受け取る任意手順に分ける。
- 生成のhashや並び順はWindows/Linuxで安定させる。データ・schema・APIの版を区別し、互換性が変わる変更では型・README・利用例を更新する。
- `@smogon/calc` の版更新ではカタログ・日本語対応・adapter・KO英文と参考訳の対応をまとめて検証する。

### 作業用素材

`others/` は、存在する場合にだけ参照するGit追跡外の作業用素材置き場である。
アプリから直接importせず、通常の生成・テスト・ビルドやREADMEの利用手順で存在を前提にしない。
素材を採用するときは必要な範囲だけ `scripts/`、`src/data/overrides/`、`public/assets/` などへ移し、出所と再利用・検証方法を記録する。

日本語素材は既存の同梱データとChampionCreator由来の対応を優先し、不足分の別データ採用は対応範囲を示して確認する。
ChampionCreatorはプロジェクト所有者の参照元として利用でき、ライセンス確認だけを理由に作業を止めない。
追跡外の調査一覧や監査結果を、実行時または通常生成の必須入力へ昇格させない。

### 画像

画像の参照元は `pokemon-options.gen.json` の `artwork` とする。必要な画像だけを遅延読み込みし、読み込み失敗時の文字表示を維持する。
参照と実ファイルを揃え、画像変更時・公開前には `validate:artwork-assets` を通す。
画像は計算から独立したUI素材であり、フォームや特性を推定する根拠にしない。

## 検証

変更に応じて意味のある検証を選び、実行したコマンドと結果を記録する。

| 変更対象 | 主な検証 |
| --- | --- |
| 名前・別名・正規化 | 対象種別の日本語・英語・ID、表記揺れ、曖昧入力、未知入力、既存入力互換のテスト |
| 計算adapter | 同じ明示条件による `@smogon/calc` 直接呼び出しとの比較と代表ケース |
| formatter・参考訳 | 日本語表示、英語fallback、構造値・原文保持、未知の版・形式・効果 |
| 保存形式 | JSONの書き出し・読み戻し、無効入力、schemaVersionと互換性 |
| 生成データ・補正 | 対応する `validate:*` と再生成差分、出所・状態・ID・参照の整合性 |
| Showdown表示API | 6種別の名前とID、外部識別子保持、全status、フォーム・共有名・対象外、配布物の利用例 |
| UI | 関連テスト・ビルドと、可能な範囲のブラウザ操作。レイアウト変更は狭い画面幅でも確認 |
| 文書のみ | コマンド・パス・リンク・API記述と実装の照合、Markdown構造、`git diff --check` |

計算の期待値は独自式から作らず、`@smogon/calc` を基準にする。
文字列・フォーム・URLなどの指定はそのまま検証し、近い表現に置き換えない。
生成結果は再生成で検証し、元のスナップショットを修正して検証を通さない。
ブラウザや実行環境の制約がある場合は、確認済みの範囲と未確認の範囲を分けて報告する。

公開前や依存版更新時は、4つの `validate:*`、`npm test`、`npm run build`、`npm run build:showdown` を通す。
成功終了だけで完全対応と判断せず、summaryとwarningにある未対応・暫定項目も確認する。

## 文書と進捗

- READMEは現行の使い方・仕様・制限・保守手順を説明する。作業履歴、検証報告、会話上の判断経緯を混ぜない。
- 「ユーザー提示」「ユーザーが採用を承認」などの会話依存の説明は避け、データの出所と現在の表示方針を記述する。
- 構成図やコマンドは実在するものに合わせ、通常手順で追跡外のファイルへリンクしない。
- AGENTSは継続的に守る責務・境界・検証・判断ルールを記述する。初期実装のマイルストーンや未採用の計画は置かない。

意味のある作業完了・検証・ブロッカー・引き継ぎは、個人用 `progress-update` skillを使って `PROGRESS.md` へ記録する。
Format 2の `Current Snapshot` と直近の記録を必要な範囲だけ読み、通常の確認で履歴全体を読み込まない。
原則として依頼ごとに1記録へまとめ、結果・検証・残作業・次の手順を簡潔に残す。
完了記録は直近10件を保持し、古い完了記録は `PROGRESS.archive/YYYY-MM.md` へ本文と番号を維持して移す。未解決記録は残す。
連番はactiveとarchive全体で維持し、両方の進捗ファイルはGit追跡外のローカル記録として扱う。

## 判断が必要な変更

次の変更は影響と選択肢を短く示し、依頼内で明示されていない場合は確認する。

- `@smogon/calc` 未対応仕様をadapterやoverlayで仮対応するか、未対応表示に留めるか。
- 既存の日本語素材で不足する部分に、新しいfallbackデータを採用すること。
- 公開範囲、GitHub Pagesの設定変更、push、PR作成、release。
- 実行時API・DB・サーバー・継続的なscrapingなど、運用依存を増やすこと。

薄いadapter、日本語レイヤー内の変更、静的動作、計算条件の再現性、説明可能なテストを優先する。
上流内部へ深く依存する処理や、表示mappingのための計算分岐を追加しない。
