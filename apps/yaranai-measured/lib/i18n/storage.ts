// 表示言語の永続化。端末ローカルの単一キーで持つ(ユーザー横断)。
// 言語は個人情報ではなく端末の読みやすさの設定なので、user_id では分けない。
// ログアウトでも消さない(記事状態と同じ扱い)。

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LANG, type Lang } from './types';

const LANG_KEY = 'yaranai.language.v1';

export async function loadLang(): Promise<Lang> {
  try {
    const raw = await AsyncStorage.getItem(LANG_KEY);
    return raw === 'en' || raw === 'ja' ? raw : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export async function saveLang(lang: Lang): Promise<void> {
  try {
    await AsyncStorage.setItem(LANG_KEY, lang);
  } catch {
    // 保存失敗は握りつぶす。次回起動でデフォルトに戻るだけで、壊れはしない。
  }
}
