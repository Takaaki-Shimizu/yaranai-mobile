-- ============================================================
-- Yaranai 実測版 スキーマ (2026-07-05)
-- 対象: measured_vows / measured_daily + ビュー2本
--
-- 重要: 申告版とは別のSupabaseプロジェクトに投入すること。
-- サーバーに置くのは「誓い対象アプリの日次実測合計」と「基準線」だけ。
-- 全アプリの利用ログは端末内DB(expo-sqlite)にのみ蓄積される。
--
-- 使い方: Supabase Dashboard → SQL Editor に全文貼り付けて Run
-- ============================================================

-- ------------------------------------------------------------
-- 1. measured_vows (誓い)
--    基準線は宣言時スナップショットで固定。以後変更しない。
-- ------------------------------------------------------------
create table if not exists measured_vows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  package_name text not null,
  app_label text not null,
  baseline_minutes numeric not null check (baseline_minutes >= 0),
  baseline_window_days integer not null,
  declared_on date not null default ((now() at time zone 'Asia/Tokyo'))::date,
  discontinued_on date,
  created_at timestamptz not null default now()
);

alter table measured_vows enable row level security;

create policy "Users can manage own measured_vows"
  on measured_vows for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 同じアプリへの誓いは、アクティブなものが同時に1本まで
create unique index if not exists measured_vows_active_pkg
  on measured_vows(user_id, package_name) where discontinued_on is null;

create index if not exists measured_vows_user_active_idx
  on measured_vows(user_id)
  where discontinued_on is null;

-- 誓いは最大3本まで (申告版 check_focus_limit と同形)
create or replace function check_measured_vow_limit()
returns trigger as $$
begin
  if NEW.discontinued_on is null and (
    select count(*) from measured_vows
    where user_id = NEW.user_id
      and discontinued_on is null
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
-- 2. measured_daily (日次実測。誓い対象アプリのみ同期される)
--    行がない日 = 実測が取得できなかった日 = 獲得0(庭は縮まない)。
-- ------------------------------------------------------------
create table if not exists measured_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vow_id uuid not null references measured_vows(id) on delete cascade,
  record_date date not null,
  actual_minutes integer not null check (actual_minutes >= 0),
  created_at timestamptz not null default now(),
  unique (vow_id, record_date)
);

alter table measured_daily enable row level security;

create policy "Users can manage own measured_daily"
  on measured_daily for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists measured_daily_user_date_idx
  on measured_daily(user_id, record_date);

-- ------------------------------------------------------------
-- 3. ビュー2本
--    重要: security_invoker = true を付けんとビューがRLSをすり抜ける
-- ------------------------------------------------------------

-- 3-1. 誓いごとの取り戻し時間
--      その日の取り戻し = max(0, 基準線 − 実測)。超過した日は0になるだけ。
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
  count(d.id)::int as measured_days,
  coalesce(sum(greatest(0, v.baseline_minutes - d.actual_minutes)), 0) as saved_minutes,
  round(coalesce(sum(greatest(0, v.baseline_minutes - d.actual_minutes)), 0)::numeric / 60, 1) as saved_hours
from measured_vows v
left join measured_daily d on d.vow_id = v.id
group by v.id;

-- 3-2. 庭の状態 (720時間 = 1.0 / 初期はほぼ荒れた 0.05。申告版と同一規則)
create or replace view garden_state
with (security_invoker = true) as
select
  user_id,
  round(sum(saved_minutes)::numeric / 60, 1) as total_saved_hours,
  max(((now() at time zone 'Asia/Tokyo'))::date - declared_on) as longest_days,
  greatest(0.05, least(1.0, round((sum(saved_minutes)::numeric / 60) / 720, 3))) as phase
from measured_saved
group by user_id;
