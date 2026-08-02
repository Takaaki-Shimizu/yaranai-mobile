// Google認証(オンボーディング §2)。
//
// Android向けにネイティブGoogle Sign-Inでid_tokenを取り、Supabaseの
// signInWithIdToken へ渡す。ネイティブモジュール追加のためEASフルビルドが必要で、
// OTAでは配信できない(§2)。ネイティブが組み込まれとらんビルド
// (旧dev client等)や、EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID 未設定の環境では
// 利用不可へ倒し、ボタンごと出さない(modules/usage-stats と同じ分担)。

import { supabase } from './supabase';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

// requireOptionalNativeModule 相当: JS側の評価がネイティブ不在で例外を投げても
// 「利用不可」へ倒す。Metroの解決のため依存はpackage.jsonに常に置く。
let GoogleSignin: {
  configure(options: { webClientId: string }): void;
  hasPlayServices(): Promise<boolean>;
  signIn(): Promise<{ data?: { idToken?: string | null } | null; type?: string }>;
} | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
} catch {
  GoogleSignin = null;
}

export const isGoogleAuthAvailable = GoogleSignin != null && WEB_CLIENT_ID !== '';

let configured = false;

export type GoogleAuthResult =
  | { status: 'ok' }
  | { status: 'cancelled' }
  | { status: 'failed' };

export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  if (!GoogleSignin || !isGoogleAuthAvailable) return { status: 'failed' };
  try {
    if (!configured) {
      GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
      configured = true;
    }
    await GoogleSignin.hasPlayServices();
    const result = await GoogleSignin.signIn();
    // v13+ は { type: 'cancelled' } を返す。旧版は例外で伝えるので下のcatchが拾う
    if (result?.type === 'cancelled') return { status: 'cancelled' };
    const idToken = result?.data?.idToken;
    if (!idToken) return { status: 'failed' };
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    return error ? { status: 'failed' } : { status: 'ok' };
  } catch (e) {
    const code = (e as { code?: string | number })?.code;
    // SIGN_IN_CANCELLED(旧版は '12501')は本人の取りやめ。何も告げない
    if (code === 'SIGN_IN_CANCELLED' || code === '12501' || code === 12501) {
      return { status: 'cancelled' };
    }
    console.log('[google-auth] sign-in failed', e);
    return { status: 'failed' };
  }
}
