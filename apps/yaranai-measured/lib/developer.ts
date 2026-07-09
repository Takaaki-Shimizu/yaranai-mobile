// 開発者判定(§1)。
// ログイン中セッションの email が EXPO_PUBLIC_DEV_EMAIL と一致したら開発者とみなす。
// 個人メールはソースに直書きせず、環境変数経由でのみ判定する
// (リポジトリに個人情報を残さないため)。DEV_EMAIL 未設定なら常に false = 本番挙動。

import { useSession } from '@yaranai/core';

const DEV_EMAIL = process.env.EXPO_PUBLIC_DEV_EMAIL;

/** email が開発者のものか。DEV_EMAIL 未設定なら常に false。非フック文脈でも使える */
export function isDeveloperEmail(email: string | null | undefined): boolean {
  return !!DEV_EMAIL && email === DEV_EMAIL;
}

/** ログイン中セッションが開発者か。庭まわりはこのフックで参照する */
export function useIsDeveloper(): boolean {
  const session = useSession();
  return isDeveloperEmail(session?.user?.email);
}
