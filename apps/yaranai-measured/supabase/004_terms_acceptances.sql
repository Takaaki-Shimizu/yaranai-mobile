-- ============================================================
-- Yaranai 実測版 マイグレーション 004 (2026-08-02)
-- 対象: terms_acceptances (規約同意の記録。オンボーディング §7)
--
-- 同意はサインアップ時にまず端末へ記録され、セッションが張られた起動時に
-- ここへ送られる(lib/terms.ts)。履歴テーブルであり、行の更新・削除はしない。
-- Google認証で作成されたユーザーも同じ経路で必ず記録される(§2)。
--
-- 使い方: Supabase Dashboard → SQL Editor に全文貼り付けて Run
-- ============================================================

create table if not exists terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table terms_acceptances enable row level security;

-- RLSは自分の行のみ。履歴やけん update / delete のポリシーは作らない
create policy "Users can read own terms_acceptances"
  on terms_acceptances for select
  using (auth.uid() = user_id);

create policy "Users can insert own terms_acceptances"
  on terms_acceptances for insert
  with check (auth.uid() = user_id);

create index if not exists terms_acceptances_user_idx
  on terms_acceptances(user_id);
