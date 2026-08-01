-- ============================================================
-- Yaranai 実測版 スキーマ追加: 誓いの「卒業」 (2026-08-01)
-- 対象: measured_vows.graduated_on + 3本制限トリガー + ビュー2本の作り直し
--
-- 実測版のSupabaseプロジェクト(001_schema.sql / 002_excuse_declarations.sql を
-- 入れたほうの)に投入すること。
--
-- 使い方: Supabase Dashboard → SQL Editor に全文貼り付けて Run
--
-- 何度でも流し直してよい(全文が冪等)。SQL Editor は貼った全文をひとつの
-- トランザクションで走らせるので、途中の1文でも落ちると「1文も適用されない」。
--
-- 指示書では 002_graduation.sql という名前やったが、002 は言い訳カードで
-- 埋まっとるため 003 に繰り下げた。適用順は 001 → 002 → 003。
--
-- ------------------------------------------------------------
-- この機能の設計原則(SQLを読む前に)
--
--   卒業は成功でしか起きない。条件は「直近7日、一度も使っていない」だけで、
--   挑戦中(使用が残っている)の誓いを外す手段はどこにも用意しない。
--   卒業したら3本の枠からは外れるが、同期と取り戻しカウントは続く
--   (= 庭の蓄積は止まらない)。ぶり返したら graduated_on を NULL へ戻すだけで
--   計測に復帰でき、基準線はどの経路でも再計算しない(五原則3)。
--
--   誓いの3状態:
--     active       discontinued_on is null and graduated_on is null   3本に数える / 同期する
--     graduated    discontinued_on is null and graduated_on is not null  数えない / 同期する
--     discontinued discontinued_on is not null                        数えない / 同期しない
-- ============================================================

-- ------------------------------------------------------------
-- 1. graduated_on 列
--
--    卒業日。NULL = まだ挑戦中。卒業履歴は持たない(再卒業は上書き)。
--    declared_on と同じく Asia/Tokyo の暦日で入れる。
-- ------------------------------------------------------------
alter table measured_vows add column if not exists graduated_on date;

-- 挑戦中の誓いだけを引く索引。3本制限の判定と、クライアントの枠判定が使う。
create index if not exists measured_vows_user_challenging_idx
  on measured_vows(user_id)
  where discontinued_on is null and graduated_on is null;

-- ------------------------------------------------------------
-- 2. 3本制限を「挑戦中の誓いは3本」へ読み替える
--
--    発火するのは active になる行だけ。卒業(graduated_on を入れる UPDATE)は
--    制限の対象外なので、3本埋まっとる状態からでも必ず通る。
--
--    逆に復帰(graduated_on を NULL へ戻す UPDATE)は active になる行なので、
--    すでに3本挑戦中ならここで弾かれる。枠の担保はこのトリガーが唯一の正で、
--    クライアント側の事前チェックは UX 向上のための補助でしかない。
-- ------------------------------------------------------------
create or replace function check_measured_vow_limit()
returns trigger as $$
begin
  if NEW.discontinued_on is null and NEW.graduated_on is null and (
    select count(*) from measured_vows
    where user_id = NEW.user_id
      and discontinued_on is null
      and graduated_on is null
      and id != NEW.id
  ) >= 3 then
    raise exception '手元におけるのは最大3つまでです';
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists enforce_measured_vow_limit on measured_vows;
create trigger enforce_measured_vow_limit
  before insert or update on measured_vows
  for each row execute function check_measured_vow_limit();

-- ------------------------------------------------------------
-- 3. 同一アプリの二重の誓いは作らせない(既存 index はそのまま)
--
--    measured_vows_active_pkg は where discontinued_on is null。graduated も
--    discontinued_on is null なので、この index に含まれ続ける。つまり
--    卒業済みパッケージへの新規宣言(INSERT)は unique 違反で弾かれる。
--    これは意図した挙動: 卒業したアプリに対してできるのは復帰だけ。
--    (念のためここでは触らない。001 の定義をそのまま生かす)
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 4. ビュー2本を作り直す
--
--    確認結果(指示書 §2-4): 001 の measured_saved / garden_state は
--    vow の状態による where 句を一切持っとらん。measured_saved は
--    measured_vows を全行 left join し、garden_state はその全行を合算する。
--    よって graduated の日次行も、これまでどおり合算され続ける
--    (= 卒業しても取り戻しは積もり、庭は止まらない)。フィルタの追加は不要。
--
--    変更は1点だけ: measured_saved に graduated_on を足す。ホームが
--    このビュー1本で「挑戦中の行」と「卒業済みの行」を描き分けるため。
--    create or replace view は列の途中差し込みができんので、
--    依存しとる garden_state ごと落として作り直す(定義は 001 と同一)。
-- ------------------------------------------------------------
drop view if exists garden_state;
drop view if exists measured_saved;

-- 4-1. 誓いごとの取り戻し時間
--      その日の取り戻し = max(0, 基準線 − 実測)。超過した日は0になるだけ。
--      卒業・廃止でこの合算は変わらない(消えない蓄積)。
create or replace view measured_saved
with (security_invoker = true) as
select
  v.id as vow_id,
  v.user_id,
  v.package_name,
  v.app_label,
  v.baseline_minutes,
  v.baseline_window_days,
  v.declared_on,
  v.discontinued_on,
  v.graduated_on,
  count(d.id)::int as measured_days,
  coalesce(sum(greatest(0, v.baseline_minutes - d.actual_minutes)), 0) as saved_minutes,
  round(coalesce(sum(greatest(0, v.baseline_minutes - d.actual_minutes)), 0)::numeric / 60, 1) as saved_hours
from measured_vows v
left join measured_daily d on d.vow_id = v.id
group by v.id;

-- 4-2. 庭の状態 (210時間 = 1.0 / 初期はほぼ荒れた 0.05。申告版と同一規則)
--       210 = 2.5h/日 × 7日 × 12週(標準像)。growth.ts の MOSS_FULL_HOURS と一致させること
--       001 からの変更なし(measured_saved を落とした巻き添えで作り直しとるだけ)
create or replace view garden_state
with (security_invoker = true) as
select
  user_id,
  round(sum(saved_minutes)::numeric / 60, 1) as total_saved_hours,
  max(((now() at time zone 'Asia/Tokyo'))::date - declared_on) as longest_days,
  greatest(0.05, least(1.0, round((sum(saved_minutes)::numeric / 60) / 210, 3))) as phase
from measured_saved
group by user_id;

-- ------------------------------------------------------------
-- 5. PostgREST のスキーマキャッシュを更新
--
--    これを撃たないと、足したばかりの graduated_on 列が API 側からは
--    まだ見えず、卒業・復帰が PGRST204(列が見つからない)で落ちる。
-- ------------------------------------------------------------
notify pgrst, 'reload schema';
