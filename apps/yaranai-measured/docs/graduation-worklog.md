# 誓いの「卒業」機能 — 作業ログ

実装日: 2026-08-01 / 対象: `apps/yaranai-measured`
指示書 §9「作業ログに残すこと」への回答。

---

## 1. `measured_saved` / `garden_state` の graduated 合算確認(指示書 §2-4)

**確認結果: 001 のビュー2本は、vow の状態による where 句を一切持っていない。
よって graduated の日次行もこれまでどおり合算され続ける。フィルタの追加は不要。**

根拠(`supabase/001_schema.sql`):

- `measured_saved` は `from measured_vows v left join measured_daily d on d.vow_id = v.id`
  を `group by v.id` で畳むだけ。`where` 句が無く、`discontinued_on` も含めて
  vow の状態は**列として select しているだけ**で、絞り込みには使っていない。
  → 卒業済みの誓いの `saved_minutes` は、卒業前後を通して積もり続ける。
- `garden_state` は `from measured_saved group by user_id` で全行を合算する。
  こちらも `where` 句が無い。
  → 庭の `total_saved_hours` / `phase` / `longest_days` は卒業で変わらない
  (単調非減少を壊す変更が入る余地がない)。

**加えた変更は1点だけ**: `measured_saved` の select リストに `v.graduated_on` を追加した。
ホームがこのビュー1本で「挑戦中の行」と「卒業済みの行」を描き分けるため。
`create or replace view` は列の途中差し込みができないので、依存している
`garden_state` ごと drop → 再作成している(`garden_state` の定義は 001 と一字一句同じ)。

合算ロジック(`sum(greatest(0, baseline_minutes - actual_minutes))`)には触れていない。

## 2. マイグレーションのファイル名

指示書は `supabase/002_graduation.sql` を指定していたが、002 は
`002_excuse_declarations.sql`(言い訳カード)で既に埋まっていたため
**`supabase/003_graduation.sql`** に繰り下げた。適用順は 001 → 002 → 003。

## 3. 実装で採用した文言(**要 Takaaki レビュー**)

指示書 §5 の文言案をほぼそのまま採用した。変更したのは改行位置だけで、
語句には手を入れていない。差し替えは `lib/i18n/strings.ts` の該当キーのみで済む。

### 3-1. ホーム(`app/(app)/index.tsx`)

| キー | 日本語 | English |
|---|---|---|
| `home.graduateLink` | 卒業する | Graduate |
| `home.graduatedLabel` | 卒業 | graduated |

### 3-2. 卒業画面(`app/(app)/graduate.tsx`)

| キー | 日本語 | English |
|---|---|---|
| `graduate.lede` | {label}は、この7日、<br>一度も開かれていません。 | You haven't opened {label} once<br>in the last seven days. |
| `graduate.note` | 卒業しても、この誓いは静かに数え続けます。<br>ぶり返したときは、いつでも手元に戻せます。 | Even after you graduate, this vow keeps counting, quietly.<br>If it comes back, you can bring it to hand again. |
| `graduate.graduate` | 卒業する | Graduate |
| `graduate.back` | 戻る | Back |
| `graduate.failed` | 卒業できませんでした。もう一度お試しください。 | Couldn't graduate. Please try again. |
| `graduate.doneLede` | {label}を、卒業しました。 | You've graduated from {label}. |
| `graduate.doneWorldview` | 空いた手で、次の『やらない』を。 | With a free hand, the next "I won't." |
| `graduate.toGarden` | 庭へ | To the garden |

改行の判断:

- `lede` は「この7日、」で切った。指示書は1行だが、`{label}` にアプリ名が入ると
  実機幅(32ptパディング)で不自然に折れるため。読点で切るのは declare.baseline と同じ流儀。
- `note` は指示書どおり2文で改行。

### 3-3. 復帰(`app/(app)/observe.tsx` / `app/(app)/declare.tsx`)

| キー | 日本語 | English |
|---|---|---|
| `observe.restoreLink` | 計測に戻す | Measure this again |
| `declare.restoreBaseline` | あなたの「ふだん」は、<br>{time}のまま変わりません。 | Your "usual" is still {time}.<br>It hasn't changed. |
| `declare.restoreNote` | ここから、もう一度。 | From here, once more. |
| `declare.restore` | 計測に戻す | Measure this again |
| `declare.restoreFailed` | 計測に戻せませんでした。もう一度お試しください。 | Couldn't put it back under measurement. Please try again. |

- `restoreBaseline` の鉤括弧は、既存の `declare.note`(「この平均が、あなたの『ふだん』…」
  ではなく「ふだん」)と同じ一重鉤に揃えた。指示書の表記と同じ。
- 枠が埋まっているときは復帰ボタンの代わりに既存の `declare.limitReached`
  (「手元におけるのは、3つまでです。」)をそのまま出す。新しい文言は足していない。

### 3-4. 復帰に完了画面を作らなかった判断

指示書は復帰の完了画面を定義していない。儀式(宣言の完了画面)は最初の宣言で
一度済んでいるので、復帰は `graduated_on = null` の UPDATE 後に黙って庭へ還す
(`router.replace('/(app)')`)。「ここから、もう一度。」は確認画面側に置いた。
祝いを二度置かないほうが静かだという判断。**ここも要レビュー。**

## 4. 判定窓の共通化(指示書 §4)

`lib/dates.ts` に `RECENT_WINDOW_DAYS = 7` / `recentWindowStart()` / `recentWindowDates()`
を置き、observe の候補窓(`getWeeklyTopApps(...)` の引数)と卒業判定の両方が
そこだけを参照する形にした。片方だけ窓が動くことは構造的に起きない。
`lib/__tests__/graduation.test.ts` に窓の性質(7日・昇順・当日を含む・
`recentWindowStart()` と始端が一致)を検算するテストを1本入れてある。

## 5. 「使った日」の判定を分ではなく ms で見ている理由

端末内DBの `foreground_ms` を分に丸めると、20〜30秒の使用が「0分」になり、
「1分も開いていない」と「ちょっとだけ開いた」が同じ顔になる。受け入れ基準1
(「1分でも使用がある誓いには一切現れない」)を満たすため、
`getPackageForegroundMsByDateSince` は ms のまま返し、判定は `> 0` で行う。

## 6. 触っていないもの(受け入れ基準8の確認)

`lib/garden/` 配下(`growth.ts` / `scene.ts` / `gate.ts` / `prng.ts` ほか)、
`components/garden/`、`lib/articles/`、`lib/excuse/` に差分は一切ない。
`git diff --stat` で確認できる。
