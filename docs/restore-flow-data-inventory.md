# 復元フロー データ棚卸し表(実測版)

対象: `apps/yaranai-measured` のみ。自己申告版(`apps/yaranai`)はスコープ外。
調査日: 2026-08-04 / 調査時点の HEAD: `b37443d`
調査種別: **read-only**(コード変更・マイグレーション新規作成は一切していない)

## 0. 分類の定義

| 分類 | 意味 | 復元の考え方 |
|---|---|---|
| **A** | 正本が Supabase にある。再インストールしてもサーバーから引き直せる | ログインすれば戻る |
| **B** | 正本は Supabase だが、端末側にキャッシュ/高水位マークがある。端末側が消えても A から再導出できる | 再計算で戻る |
| **C** | 端末にしか存在しない。再インストールで**恒久的に失われる** | 戻らない(設計判断が要る) |

## 1. テーブル名の読み替え(棚卸し表の修正)

元の棚卸し表にあった `yaranai_items` / `daily_records` は**自己申告版の名称**である。
実測版には存在しない(`apps/yaranai/supabase/001_mvp_schema.sql` 側の名称)。実測版の実体は下表のとおり。

| 棚卸し表の旧表記 | 実測版の実体 | 定義箇所 |
|---|---|---|
| `yaranai_items` | `measured_vows`(テーブル) | `apps/yaranai-measured/supabase/001_schema.sql:16-26` + `003_graduation.sql:37` |
| `daily_records` | `measured_daily`(テーブル) | `apps/yaranai-measured/supabase/001_schema.sql:68-76` |
| (該当なし) | `measured_saved`(ビュー) | `apps/yaranai-measured/supabase/003_graduation.sql:105-122` |
| (該当なし) | `garden_state`(ビュー) | `apps/yaranai-measured/supabase/003_graduation.sql:127-135` |
| (該当なし) | `excuse_declarations` / `app_events` | `apps/yaranai-measured/supabase/002_excuse_declarations.sql:30-38, 96-102` |
| (該当なし) | `terms_acceptances` | `apps/yaranai-measured/supabase/004_terms_acceptances.sql:12-19` |

`garden_state` は**テーブルではなくビュー**であり、`measured_saved` の集計にすぎない。
「`garden_state` に庭の状態が保存されている」という読み方は誤りで、庭の状態を保持する行はどこにも無い(毎回導出される)。

---

## 2. 棚卸し表(18項目)

「現在の保存先」の ❓ をすべて実装上の事実で埋めた。確度が `未確認` の行には、何を見れば確定するかを書いた。

### A分類 — 正本 = Supabase

| # | 項目 | 現在の保存先 | 根拠 | 確度 | ギャップ / 移行作業 |
|---|---|---|---|---|---|
| 1 | 断つ宣言(誓い) | Supabase `measured_vows`(1行=1誓い)。書き込みは `insert` 1箇所のみ | `supabase/001_schema.sql:16-26` / `app/(app)/declare.tsx:122-128` | 確定 | **移行不要。** 復元フローは `measured_vows` を `user_id` で引くだけでよい |
| 2 | 基準線(宣言時12週平均・分/日) | Supabase `measured_vows.baseline_minutes`(`numeric not null check (>= 0)`) | `supabase/001_schema.sql:21` / `app/(app)/declare.tsx:126` | 確定 | **移行不要。** 事前の懸念(端末のみ保持)は該当しない。復元後も宣言時の値がそのまま戻る |
| 3 | 基準線の窓日数(実際に集計できた日数) | Supabase `measured_vows.baseline_window_days`(`integer not null`)。`BaselineResult.windowDays` = `availableDays` がそのまま入る | `supabase/001_schema.sql:22` / `lib/baseline.ts:51-59` / `app/(app)/declare.tsx:127` | 確定 | **移行不要。** 復元後の数値検証(何日で割った平均か)は可能 |
| 4 | 宣言日 `declared_on` | Supabase `measured_vows.declared_on`(`date not null default (now() at time zone 'Asia/Tokyo')::date`)。クライアントは値を送らずサーバー既定に任せる | `supabase/001_schema.sql:23` / `app/(app)/declare.tsx:122-128`(`declared_on` を送っていない) | 確定 | **移行不要。** ただし復元は「新しい端末に古い宣言日が載る」ことを許容する設計になっている必要がある |
| 5 | 卒業日 `graduated_on` | Supabase `measured_vows.graduated_on`(`date`、NULL=挑戦中)。003 で追加 | `supabase/003_graduation.sql:37` / `app/(app)/graduate.tsx:51-54` | 確定 | **移行不要。** ただし 003 未適用プロジェクトへの耐性コードが各所にある(`lib/vows.ts:16-20`)。復元先の Supabase が 003 適用済みであることの確認は要る |
| 6 | 廃止日 `discontinued_on` | Supabase `measured_vows.discontinued_on`(`date`)。**この列に書き込むコードはアプリ内に1箇所も存在しない**(読み取り専用の絞り込みにしか使われていない) | `supabase/001_schema.sql:24` / 全 `.ts`/`.tsx` を grep しても `update({ discontinued_on` に相当する記述なし | 確定 | **移行不要**(常に NULL)。ただし §5-1 の想定外事項として記録。復元時に `discontinued_on` を条件に入れても実質すべて通る |
| 7 | 日次実測(誓い対象アプリの日次合計) | Supabase `measured_daily`(`vow_id, record_date, actual_minutes`、`unique (vow_id, record_date)`) | `supabase/001_schema.sql:68-76` / `lib/usage-sync.ts:100-113` | 確定 | **移行不要だが欠落リスクあり。** 6日以上アプリを開かなかった期間の行は端末にもサーバーにも存在せず、復元とは無関係に恒久欠落する(→ 報告書 Q4) |
| 8 | 言い訳カードの宣言 | Supabase `excuse_declarations`(`what_text`, `declared_on`, `superseded_at`)。端末 AsyncStorage `yaranai.excuse.current.v1:{userId}` は**キャッシュ**(pending 時のみ一時的な正本) | `supabase/002_excuse_declarations.sql:30-38` / `lib/excuse/storage.ts:29, 174-195` | 確定 | **移行不要。** ただし `pending: true` のまま端末が失われた宣言はサーバーに届かず消える(→ 報告書 §5-2) |
| 9 | カード共有イベントログ | Supabase `app_events`(`event='excuse_card_shared'`, `payload={size}`) | `supabase/002_excuse_declarations.sql:96-102` / `lib/excuse/storage.ts:214-219` | 確定 | **移行不要。** 復元フローでは読み出す必要がない(表示に使われていない) |
| 10 | 規約同意の記録 | Supabase `terms_acceptances`(履歴テーブル)。端末 AsyncStorage `terms.consent` は未送信ぶんの控え | `supabase/004_terms_acceptances.sql:12-19` / `lib/terms.ts:23, 50-79` | 確定 | **移行不要。** 復元後は端末側 `terms.consent` が無い状態で起動するため再送は走らないが、正本はサーバーに残る |

### B分類 — 再計算で復元できるもの

| # | 項目 | 現在の保存先 | 根拠 | 確度 | ギャップ / 移行作業 |
|---|---|---|---|---|---|
| 11 | 庭の成長パラメータ(石・道・苔・週数・朱) | **どこにも保存されていない。** 毎回 Supabase から導出する純関数の出力 | `lib/garden/growth.ts:48-59` / `components/garden/load.ts:54-76` | 確定 | **移行不要。** 復元後は `measured_saved` / `measured_daily` を引き直せば同じ値が出る |
| 12 | 庭の高水位マーク(単調非減少ガード) | 端末 AsyncStorage `garden-high-water:v1:{userId}`。値は `GardenSnapshot`(`stoneCount` / `recordedDays` / `savedMinutes`) | `components/garden/load.ts:18, 66-75` | 確定 | **失われても実害は小さい。** 復元直後は Supabase 値がそのまま高水位の初期値になる。ただし「サーバー側が欠落している日数(#7)」を端末の高水位が覆い隠していた場合、**復元後に庭が後退して見える**。復元完了時に一度 `loadGrowth` を通し、その結果を高水位の初期値として書くのが自然 |
| 13 | 前回表示時の庭の状態(入庭差分演出用) | 端末 AsyncStorage `garden_last_seen_state:{userId}`。値は `GrowthParams` | `components/garden/load.ts:20, 23-39` / `app/(app)/(tabs)/index.tsx:190-196` | 確定 | **移行不要。** 失われると復元後の初回表示で「全要素が変化扱い」になり差分演出が一気に流れる。復元完了時に現在状態を `saveLastSeen` しておけば初回は無演出になる |
| 14 | 誓い別詳細のスナップショット | 端末 AsyncStorage `vow-log-snapshot:v1:{vowId}`。オフライン表示専用の写し | `lib/vow-log-cache.ts:22, 25-40` | 確定 | **移行不要。** 次回オンライン取得で自動的に埋まる |

### C分類 — 端末にしか無い(再インストールで失われる)

| # | 項目 | 現在の保存先 | 根拠 | 確度 | ギャップ / 移行作業 |
|---|---|---|---|---|---|
| 15 | 全アプリの詳細利用ログ | 端末 SQLite `yaranai-measured.db` / テーブル `usage_daily`(`record_date, package_name, foreground_ms`)。**Supabase には一切送らない** | `lib/usage-db.ts:17-27` / `lib/usage-sync.ts:14-16` のコメント | 確定 | **移行不要(設計上の意図)。** 復元後は空。OSの日次統計から直近7日ぶんだけ再構築される。復元フローはこのテーブルが空であることを前提に組む必要がある。**卒業判定(直近7日連続0分)は復元直後は必ず不成立になる**(`lib/graduation.ts:55` のガード) |
| 16 | 理想(掛け軸のテキスト) | 端末 AsyncStorage `yaranai.ideal.v1:{userId}`。**Supabase に送る経路は存在しない** | `lib/ideal/storage.ts:9, 12-28`(送信コード無し。`loadIdeal`/`saveIdeal` の呼び出しは `app/(app)/ideal.tsx` と `components/IdealHeader.tsx` のみ) | 確定 | **移行が必要。** 復元後に掛け軸が空になる。Supabase へ昇格させるなら新規カラム/テーブルが要る(本タスクでは作成しない) |
| 17 | 読みもの(コラム)の発火・既読状態 | 端末 AsyncStorage `yaranai.articles.state.v1`(**単一キー・user_id で分けない**)。値は `{ [articleId]: { firedAt, readAt } }` | `lib/articles/storage.ts:14, 16-31` / `lib/articles/types.ts:36-48` | 確定 | **移行が必要かは設計判断。** 復元後は全記事が未発火に戻り、常設記事(standing)が再び未読の帯として現れる。「一度現れたものは消えない」原則(`lib/articles/storage.ts:11-13`)とは整合するが、復元体験としては再読を強いる |
| 18 | オンボーディングの印 / 表示言語 / 同意の控え | 端末 AsyncStorage のみ。`onboarding.worldview_seen` / `onboarding.pending_email` / `onboarding.disclosure_seen` / `onboarding.permission_deferred` / `onboarding.done.{userId}` / `onboarding.waiting.{userId}` / `yaranai.language.v1` / `terms.consent` | `lib/onboarding.ts:22-27`(「印はすべてこの端末の中だけのもの。サーバーには出ない」) / `lib/i18n/storage.ts:8` / `lib/terms.ts:23` | 確定 | **移行不要(意図的)。** `onboarding.done` は「誓いが1本でもあれば完了」と導出で補われる(`app/(app)/(tabs)/index.tsx:236-243`)。ただし**権限再付与と世界観導入は復元後にもう一度通る**。言語設定は端末既定へ戻る |

---

## 3. RLS の閉じ方(復元時に他人のデータを引かないことの担保)

| オブジェクト | RLS | ポリシー | 根拠 |
|---|---|---|---|
| `measured_vows` | 有効 | `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)` | `001_schema.sql:28-33` |
| `measured_daily` | 有効 | 同上 | `001_schema.sql:78-83` |
| `excuse_declarations` | 有効 | 同上 | `002_excuse_declarations.sql:40-46` |
| `app_events` | 有効 | 同上 | `002_excuse_declarations.sql:104-110` |
| `terms_acceptances` | 有効 | select / insert のみ(update/delete ポリシー無し=不可) | `004_terms_acceptances.sql:21-30` |
| `measured_saved`(ビュー) | — | `with (security_invoker = true)`。基底テーブルの RLS がそのまま効く | `003_graduation.sql:106` |
| `garden_state`(ビュー) | — | 同上。`group by user_id` も併用 | `003_graduation.sql:128, 135` |

**結論**: A分類のすべてが `auth.uid()` で閉じている。復元フローでクライアントが `user_id` を明示せずに `select` しても、他人の行は返らない。

---

## 4. 移行作業が必要な項目(まとめ)

| # | 項目 | 必要な作業 | 緊急度 |
|---|---|---|---|
| 16 | 理想(掛け軸テキスト) | Supabase への昇格(新規カラムまたはテーブル)。現状 A分類に見えて実は C分類 | **高** — 復元しても掛け軸が空のまま |
| 7 | 日次実測の欠落 | 復元フローとは別問題。6日以上の起動間隔で日次行が恒久欠落する。復元フロー実装前に挙動を確定させておく必要がある | **高** — データの穴は復元では埋まらない |
| 12 | 庭の高水位マーク | 復元完了時に `loadGrowth` の結果で初期化する処理。マイグレーションは不要 | 中 — 復元フロー実装時に併せて対応 |
| 13 | 前回表示状態 | 復元完了時に `saveLastSeen` する処理。マイグレーションは不要 | 低 — 演出の質の問題 |
| 17 | 読みもの既読状態 | Supabase へ昇格するか、復元後の再読を許容するかの設計判断 | 低 — §6 に近い判断事項 |

**移行が不要と確定した項目**: #1〜#6, #8〜#11, #14, #15, #18。
特に、事前に懸念されていた「庭のPRNGシード」と「基準線スナップショット」は**いずれも移行不要**である(詳細は `restore-flow-investigation-report.md` の Q1 / Q2)。
