-- ============================================================
-- Yaranai 実測版 スキーマ追加: 言い訳カード (2026-07-29)
-- 対象: excuse_declarations + app_events + declare_excuse()
--
-- 実測版のSupabaseプロジェクト(001_schema.sql を入れたほうの)に投入すること。
--
-- 使い方: Supabase Dashboard → SQL Editor に全文貼り付けて Run
--
-- 何度でも流し直してよい(全文が冪等)。SQL Editor は貼った全文をひとつの
-- トランザクションで走らせるので、途中の1文でも落ちると「1文も適用されない」。
-- 既存のポリシーに当たって全部が巻き戻る事故を防ぐため、create policy の前に
-- drop policy if exists を置いてある。
--
-- 宣言が「宣言できませんでした」で止まるときは、まずこの全文を流し直すこと。
-- ============================================================

-- ------------------------------------------------------------
-- 1. excuse_declarations (言い訳カードの宣言)
--
--    1人1枚。同時に持てる現行の宣言は superseded_at is null の1件だけ。
--    差し替えは自由(回数制限なし)だが、旧行は削除しない ── superseded 化して残す
--    (単調非減少の原則。本人だけが見られる履歴になる)。
--
--    正本はここ。カード宣言はアンインストールで消えてはならない(復元フローのA分類)。
--    端末側(AsyncStorage)はあくまでキャッシュ。
--
--    庭には一切接続しない。このテーブルは measured_vows / measured_daily /
--    garden_state のどれとも結合されない(§2-6)。
-- ------------------------------------------------------------
create table if not exists excuse_declarations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  what_text text not null check (length(btrim(what_text)) > 0),
  declared_on date not null default ((now() at time zone 'Asia/Tokyo'))::date,
  created_at timestamptz not null default now(),
  -- null = 現行。値が入っていれば差し替え済みの旧宣言
  superseded_at timestamptz
);

alter table excuse_declarations enable row level security;

drop policy if exists "Users can manage own excuse_declarations" on excuse_declarations;
create policy "Users can manage own excuse_declarations"
  on excuse_declarations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 1人1枚(§2-1)。現行の宣言は同時に1件までしか存在できない
create unique index if not exists excuse_declarations_current
  on excuse_declarations(user_id) where superseded_at is null;

create index if not exists excuse_declarations_user_idx
  on excuse_declarations(user_id, created_at desc);

-- ------------------------------------------------------------
-- 2. declare_excuse() (作成・差し替え)
--
--    旧宣言の superseded 化と新宣言の挿入を1トランザクションで行う。
--    クライアントから2回に分けて叩くと、間で失敗したときに
--    「現行が1枚もない」状態が残り得るため、必ずこの関数を通すこと。
--
--    security invoker(既定)なので RLS はそのまま効く。
-- ------------------------------------------------------------
create or replace function declare_excuse(p_what_text text)
returns excuse_declarations as $$
declare
  v_row excuse_declarations;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update excuse_declarations
    set superseded_at = now()
    where user_id = auth.uid() and superseded_at is null;

  insert into excuse_declarations (user_id, what_text)
    values (auth.uid(), p_what_text)
    returning * into v_row;

  return v_row;
end;
$$ language plpgsql;

grant execute on function declare_excuse(text) to authenticated;

-- ------------------------------------------------------------
-- 3. app_events (アプリ内の出来事のログ)
--
--    言い訳カードの共有を記録するために置く最小のログ基盤。
--    共有イベントは excuse_card_shared、payload はサイズ種別だけ。
--    共有先アプリ名は取得しない(§6)。
--
--    書き込みのみ。読み出しは本人の行に限る(RLSは他テーブルと同じ方針)。
-- ------------------------------------------------------------
create table if not exists app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table app_events enable row level security;

drop policy if exists "Users can manage own app_events" on app_events;
create policy "Users can manage own app_events"
  on app_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists app_events_user_created_idx
  on app_events(user_id, created_at desc);

-- ------------------------------------------------------------
-- 4. PostgREST のスキーマキャッシュを更新
--
--    これを撃たないと、作ったばかりの declare_excuse() が API 側からは
--    まだ見えず、宣言が PGRST202(関数が見つからない)で落ちることがある。
-- ------------------------------------------------------------
notify pgrst, 'reload schema';
