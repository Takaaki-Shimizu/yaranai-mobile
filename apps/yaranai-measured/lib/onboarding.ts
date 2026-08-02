// オンボーディングの進行状態(オンボーディング §7)。
//
// 原則: セッション有無・権限有無・宣言有無から導出できるステップは導出を優先し、
// ここに置く印は「導出だけでは区別できない地点」の補助に限る:
//
//   - worldview_seen      世界観導入を通過した(とばす も通過に数える)
//   - pending_email       メール確認待ちのアドレス。未確認のまま再起動しても
//                         確認待ち画面([C])から再開するための印
//   - disclosure_seen     目立つ開示([D])で「わかった、設定へ」を押した。
//                         再起動時に [E] から再開するための印
//   - permission_deferred 使用状況アクセスを「あとで」にした。ホームは観測なしの
//                         静かな案内を出し、許可の画面へ勝手に連れ戻さない
//   - done.<userId>       オンボーディング完了。宣言1本、または待機モード入りで立つ。
//                         宣言が既にあるユーザー(既存ユーザー)は導出で立てる
//   - waiting.<userId>    履歴28日未満の待機モード([F'])でホームへ抜けた。
//                         28日に達した起動で時間の行き先へ誘導したら畳む
//
// 印はすべてこの端末の中だけのもの。サーバーには出ない。

import AsyncStorage from '@react-native-async-storage/async-storage';

const WORLDVIEW_SEEN_KEY = 'onboarding.worldview_seen';
const PENDING_EMAIL_KEY = 'onboarding.pending_email';
const DISCLOSURE_SEEN_KEY = 'onboarding.disclosure_seen';
const PERMISSION_DEFERRED_KEY = 'onboarding.permission_deferred';
const doneKey = (userId: string) => `onboarding.done.${userId}`;
const waitingKey = (userId: string) => `onboarding.waiting.${userId}`;

async function getFlag(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) === '1';
  } catch {
    return false;
  }
}

async function setFlag(key: string, on: boolean): Promise<void> {
  try {
    if (on) await AsyncStorage.setItem(key, '1');
    else await AsyncStorage.removeItem(key);
  } catch {
    // 書けんかった回は諦める。次の機会に導出が補う
  }
}

export const isWorldviewSeen = () => getFlag(WORLDVIEW_SEEN_KEY);
export const markWorldviewSeen = () => setFlag(WORLDVIEW_SEEN_KEY, true);

export async function getPendingEmail(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PENDING_EMAIL_KEY);
  } catch {
    return null;
  }
}

export async function setPendingEmail(email: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_EMAIL_KEY, email);
  } catch {
    // 保存できんでも確認待ち画面そのものは出る(再起動時の再開だけが効かん)
  }
}

export const clearPendingEmail = () => setFlag(PENDING_EMAIL_KEY, false);

export const isDisclosureSeen = () => getFlag(DISCLOSURE_SEEN_KEY);
export const markDisclosureSeen = () => setFlag(DISCLOSURE_SEEN_KEY, true);

export const isPermissionDeferred = () => getFlag(PERMISSION_DEFERRED_KEY);
export const setPermissionDeferred = () => setFlag(PERMISSION_DEFERRED_KEY, true);
export const clearPermissionDeferred = () => setFlag(PERMISSION_DEFERRED_KEY, false);

export const isOnboardingDone = (userId: string) => getFlag(doneKey(userId));
export const markOnboardingDone = (userId: string) => setFlag(doneKey(userId), true);

export const isWaitingMode = (userId: string) => getFlag(waitingKey(userId));
export const setWaitingMode = (userId: string) => setFlag(waitingKey(userId), true);
export const clearWaitingMode = (userId: string) => setFlag(waitingKey(userId), false);
