// 利用規約・プライバシーポリシーへの同意(オンボーディング §2・§7)。
//
// 同意はまずローカルに記録し、セッションが張られた起動時にSupabaseへ送る
// (オフラインでサインアップが進んだ場合の再送用)。terms_acceptances は
// 履歴テーブルで、行の書き換えはしない。
//
// 規約URLは現時点で未公開(§10)。リンク先が404の間は、ビルドフラグ
// EXPO_PUBLIC_HIDE_TERMS_CONSENT=1 で同意行ごと非表示にできる(クローズドテスト用)。

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export const TERMS_URL = 'https://yaranai.app/terms';
export const PRIVACY_URL = 'https://yaranai.app/privacy';

// 規約のバージョン識別子。本文を改訂したらここを上げる(本文の作成は別トラック §9)
export const TERMS_VERSION = '2026-08-02';
export const PRIVACY_VERSION = '2026-08-02';

// クローズドテスト用: 規約URLが404の間は同意行ごと畳む(§10)
export const CONSENT_ROW_HIDDEN = process.env.EXPO_PUBLIC_HIDE_TERMS_CONSENT === '1';

const CONSENT_KEY = 'terms.consent';

type LocalConsent = {
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: string; // ISO 8601
  synced: boolean;
};

// 同意した瞬間(サインアップ開始時)にローカルへ記録する。メール確認待ちや
// オフラインでアカウント作成が後ろへずれても、同意の日時はこの値が正。
export async function recordLocalConsent(): Promise<void> {
  const consent: LocalConsent = {
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    acceptedAt: new Date().toISOString(),
    synced: false,
  };
  try {
    await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  } catch {
    // 記録できんかった回は諦める(同意チェックそのものはUI側で担保されとる)
  }
}

// 未送信のローカル同意をSupabaseへ送る。セッションが張られた起動ごとに呼ばれ、
// 送れたら synced を立てて二重送信を防ぐ。失敗したら次の起動でまた試す。
export async function syncConsentToSupabase(userId: string): Promise<void> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(CONSENT_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  let consent: LocalConsent;
  try {
    consent = JSON.parse(raw) as LocalConsent;
  } catch {
    return;
  }
  if (consent.synced) return;
  const { error } = await supabase.from('terms_acceptances').insert({
    user_id: userId,
    terms_version: consent.termsVersion,
    privacy_version: consent.privacyVersion,
    accepted_at: consent.acceptedAt,
  });
  if (error) {
    console.log(`[terms] consent sync failed: ${error.code} ${error.message}`);
    return;
  }
  try {
    await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify({ ...consent, synced: true }));
  } catch {
    // 印が書けんかった場合は次回も送るが、履歴テーブルへの重複追記に留まる
  }
}
