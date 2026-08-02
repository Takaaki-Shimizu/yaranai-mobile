// アカウント削除 Edge Function (設定+お問い合わせ スペック §5.4)
//
// auth.users の削除はクライアントSDKからは実行できないため、この関数が
// service_role キーで auth.admin.deleteUser() を呼ぶ。measured_vows /
// measured_daily / terms_acceptances は user_id が auth.users(id) を
// on delete cascade で参照しとるけん、この1回で連鎖して消える。
//
// 消せるのは「呼び出した本人」だけ: 対象の user id はリクエストの JWT から
// 取り出す。パラメータでは受け取らない(他人の id を渡される穴を作らない)。
//
// デプロイ: supabase functions deploy delete-account
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY は Supabase が自動で注入する)

import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json({ error: 'unauthorized' }, 401);

  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) {
    console.error(`delete-account failed for ${data.user.id}: ${deleteError.message}`);
    return json({ error: 'delete_failed' }, 500);
  }

  return json({ ok: true }, 200);
});
