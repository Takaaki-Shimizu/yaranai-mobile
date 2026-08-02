// アカウント削除の実処理(設定+お問い合わせ スペック §5.4)。
//
// auth.users の削除はクライアントSDKから直接実行できないため、Edge Function
// (supabase/functions/delete-account)が service_role キーで auth.admin.deleteUser()
// を呼ぶ。measured_vows / measured_daily は on delete cascade で連鎖して消える。
//
// 順序はサーバー側の削除を先にする。端末内を先に消すと、サーバー側が失敗した
// ときに「アカウントは生きとるのに利用記録だけ消えた」中途半端が残る。
// サーバー側が消えた後の端末内の掃除は、失敗しても孤児データが残るだけで
// アカウントの実体はもう無い ── 削除の成否はサーバー側だけで判定する。

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { clearAllUsageData } from './usage-db';

export async function deleteAccount(userId: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.functions.invoke('delete-account');
  if (error) {
    console.log(`[account] delete failed: ${error.message}`);
    return { ok: false };
  }

  // 端末内の利用記録(§5.3 の約束「あわせて消去されます」)。SQLite の実測ログと、
  // このユーザーに紐づく庭の高水位マーク。掃除の失敗で削除を失敗扱いにはしない
  try {
    await clearAllUsageData();
  } catch {
    // 消せんかった行は user_id を持たず、次のアカウントの庭には効かない
  }
  await AsyncStorage.multiRemove([
    `garden-high-water:v1:${userId}`,
    `garden_last_seen_state:${userId}`,
  ]).catch(() => {});

  // アカウントはもう無いけん、サーバーへは行かず端末のセッションだけを畳む
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  return { ok: true };
}
