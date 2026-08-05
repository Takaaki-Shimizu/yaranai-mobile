-- ============================================================
-- Yaranai 実測版 マイグレーション 005 (2026-08-04)
-- 対象: user_ideals (理想=掛け軸のテキスト。復元フロー前提③の①)
--
-- 実測版のSupabaseプロジェクト(001〜004 を入れたほうの)に投入すること。
--
-- 使い方: Supabase Dashboard → SQL Editor に全文貼り付けて Run
--
-- 何度でも流し直してよい(全文が冪等)。SQL Editor は貼った全文をひとつの
-- トランザクションで走らせるので、途中の1文でも落ちると「1文も適用されない」。
-- 既存のポリシーに当たって全部が巻き戻る事故を防ぐため、create policy の前に
-- drop policy if exists を置いてある(002 と同じ作法)。
--
-- 指示書では 004_ideal.sql という名前やったが、004 は規約同意
-- (terms_acceptances)で埋まっとるため 005 に繰り下げた。適用順は 001 → 005。
--
-- ------------------------------------------------------------
-- なぜこのテーブルが要るか
--
--   理想(WHAT)はこれまで端末の AsyncStorage 'yaranai.ideal.v1:{userId}' にしか
--   無く、機種変更・再インストールで空に戻っとった(復元フロー調査 Q5-1)。
--   庭の直上に常設される一文が、時間だけ戻って言葉だけ消えるのは、
--   「なぜ時間を取り戻すのか」の答えを預かるものとして通らん。正本をここへ移す。
--
--   ユーザー単位で1行。誓いごとではない ── 画面の実体がそうなっとる
--   (IdealHeader はホームに1つ、編集画面 app/(app)/ideal.tsx も vowId を取らん)。
--
--   庭には一切接続しない。measured_vows / measured_daily / garden_state の
--   どれとも結合しない(言い訳カードと同じ扱い)。
-- ============================================================

-- ------------------------------------------------------------
-- 1. user_ideals (理想=掛け軸のテキスト)
--
--    user_id が主キー。1人1行で、履歴は持たない(掛け軸は書き換えるもの)。
--
--    ideal_text が空文字の行は「本人が理想を消した」を意味する。行が無い状態
--    (=まだ一度も設定していない/未移行)とは区別すること ── クライアントは
--    「行が無い」ときだけ端末の値をサーバーへ押し上げる(移行)。ここを潰すと、
--    端末Aで消した理想が、端末Bに残っとった古い写しから復活する。
--
--    文字数の CHECK は意図的に置かない。上限20文字はクライアント側の規則
--    (lib/ideal/validate.ts の IDEAL_MAX_LENGTH)やが、上限を入れる前に
--    保存された21文字以上の値が端末に残っとる(app/(app)/ideal.tsx:36-37 が
--    「21文字以上でも勝手に切り詰めない」と明記)。ここで弾くと、その値を持つ
--    既存ユーザーの移行だけが恒久的に失敗し、理想が端末に取り残される。
-- ------------------------------------------------------------
create table if not exists user_ideals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ideal_text text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table user_ideals enable row level security;

-- RLSは自分の行のみ(他テーブルと同じ方針)。
-- 削除のポリシーは作らない ── 理想を消す操作は ideal_text = '' の更新であって、
-- 行の削除ではない(上記の「消した」と「未設定」の区別を保つため)。
-- アカウント削除は auth.users の削除から on delete cascade で連鎖する。
drop policy if exists "Users can read own user_ideals" on user_ideals;
create policy "Users can read own user_ideals"
  on user_ideals for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own user_ideals" on user_ideals;
create policy "Users can insert own user_ideals"
  on user_ideals for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own user_ideals" on user_ideals;
create policy "Users can update own user_ideals"
  on user_ideals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2. PostgREST のスキーマキャッシュを更新
--
--    これを撃たないと、作ったばかりの user_ideals が API 側からは
--    まだ見えず、理想の保存が PGRST205(テーブルが見つからない)で落ちる。
-- ------------------------------------------------------------
notify pgrst, 'reload schema';
