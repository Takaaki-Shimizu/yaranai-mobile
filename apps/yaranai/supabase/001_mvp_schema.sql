-- ============================================================
-- Yaranai MVP スキーマ (2026-07-04 確定版)
-- 対象: yaranai_items / daily_records + ビュー3本
-- 残り6テーブル(goals, vow_goal_links, weekly_reviews,
-- deadline_reviews, share_cards ほか)は第2弾で投入する。
--
-- 使い方: Supabase Dashboard → SQL Editor に全文貼り付けて Run
-- ============================================================

-- ------------------------------------------------------------
-- 0. 日付境界: 朝4時切り替え
--    「その日」は朝4時に終わる。深夜1時のスクロールは前日の失敗。
-- ------------------------------------------------------------
create or replace function yaranai_today()
returns date
language sql
stable
as $$
  select ((now() at time zone 'Asia/Tokyo') - interval '4 hours')::date
$$;

-- ------------------------------------------------------------
-- 1. yaranai_items (誓い)
-- ------------------------------------------------------------
create table if not exists yaranai_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  note text,                          -- 宣言文/誓いのメモ(改行可)
  minutes_per_day integer not null check (minutes_per_day >= 0 and minutes_per_day <= 1440),
  is_focused boolean not null default false,
  started_at date not null default yaranai_today(),
  discontinued_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table yaranai_items enable row level security;

create policy "Users can manage own yaranai_items"
  on yaranai_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists yaranai_items_user_active_idx
  on yaranai_items(user_id)
  where discontinued_at is null;

-- 注力枠は最大3つまで
create or replace function check_focus_limit()
returns trigger as $$
begin
  if NEW.is_focused = true and (
    select count(*) from yaranai_items
    where user_id = NEW.user_id
      and is_focused = true
      and discontinued_at is null
      and id != NEW.id
  ) >= 3 then
    raise exception '手元におけるのは最大3つまでです';
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists enforce_focus_limit on yaranai_items;
create trigger enforce_focus_limit
  before insert or update on yaranai_items
  for each row execute function check_focus_limit();

-- ------------------------------------------------------------
-- 2. daily_records (日々の記録)
--    思想: 行がない日 = kept。書き込むのは broken と明示 kept のみ。
-- ------------------------------------------------------------
create table if not exists daily_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  yaranai_item_id uuid not null references yaranai_items(id) on delete cascade,
  record_date date not null,
  status text not null check (status in ('kept', 'broken')),
  source text not null default 'focused_daily'
    check (source in ('focused_daily', 'weekly_review', 'auto_default')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (yaranai_item_id, record_date)
);

alter table daily_records enable row level security;

create policy "Users can manage own daily_records"
  on daily_records for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists daily_records_user_date_idx
  on daily_records(user_id, record_date);

-- ------------------------------------------------------------
-- 3. ビュー3本
--    重要: security_invoker = true を付けんとビューがRLSをすり抜ける
-- ------------------------------------------------------------

-- 3-1. 誓いごとの累計 (行がない日=kept はここで演算される)
create or replace view vow_saved_hours
with (security_invoker = true) as
with base as (
  select
    i.id,
    i.user_id,
    i.label,
    i.minutes_per_day,
    i.is_focused,
    i.started_at,
    i.discontinued_at,
    greatest(
      0,
      least(coalesce(i.discontinued_at, yaranai_today()), yaranai_today())
        - i.started_at + 1
    )::int as elapsed_days,
    coalesce((
      select count(*) from daily_records r
      where r.yaranai_item_id = i.id and r.status = 'broken'
    ), 0)::int as broken_days
  from yaranai_items i
)
select
  id as yaranai_item_id,
  user_id,
  label,
  minutes_per_day,
  is_focused,
  started_at,
  discontinued_at,
  elapsed_days,
  broken_days,
  greatest(0, elapsed_days - broken_days) as kept_days,
  greatest(0, elapsed_days - broken_days) * minutes_per_day as saved_minutes,
  round((greatest(0, elapsed_days - broken_days) * minutes_per_day)::numeric / 60, 1) as saved_hours
from base;

-- 3-2. 庭の状態 (720時間 = 1.0 / 初期はほぼ荒れた 0.05)
create or replace view garden_state
with (security_invoker = true) as
select
  user_id,
  round(sum(saved_minutes)::numeric / 60, 1) as total_saved_hours,
  max(elapsed_days) as longest_days,
  greatest(0.05, least(1.0, round((sum(saved_minutes)::numeric / 60) / 720, 3))) as phase
from vow_saved_hours
group by user_id;

-- 3-3. 直近42日の記録 (空白日はフロント側で kept として埋める)
create or replace view vow_recent_records
with (security_invoker = true) as
select
  user_id,
  yaranai_item_id,
  record_date,
  status
from daily_records
where record_date > yaranai_today() - 42;
