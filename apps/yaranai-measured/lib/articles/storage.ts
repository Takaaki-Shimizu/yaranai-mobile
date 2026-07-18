// ArticlesState の永続化層(実装仕様書 §3)。
// AsyncStorage に単一キーで保持する。ローカルファースト方針に従い Supabase には送らない。
// ログアウトでは消さない(§5.3): ここでキーを削除する関数は用意しない。
//
// 書き込みは state.ts の単調ガード(withFired/withRead)を通した結果だけを保存する。

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ArticlesState } from './types';
import { withFired, withRead } from './state';

// 記事状態はユーザー横断の単一キー(端末ローカル)。庭の高水位と違い user_id で分けない
// ため、共用端末では前ユーザーの発火が残る可能性はあるが、記事は個人情報を含まず
// 「一度現れたものは消えない」原則にも沿うため v1 では単一キーで持つ。
const STATE_KEY = 'yaranai.articles.state.v1';

export async function loadArticlesState(): Promise<ArticlesState> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as ArticlesState) : {};
  } catch {
    return {};
  }
}

async function saveArticlesState(state: ArticlesState): Promise<void> {
  try {
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // 保存失敗は握りつぶす。次回の起動評価/既読化で取り返す。
  }
}

// 発火を記録する(§4.3)。既に発火済みなら何もしない。更新後の状態を返す。
export async function recordFired(articleId: string, firedAt: string): Promise<ArticlesState> {
  const current = await loadArticlesState();
  const next = withFired(current, articleId, firedAt);
  if (next !== current) await saveArticlesState(next);
  return next;
}

// 既読を記録する(§5.2: 記事画面を開いた時点)。既読の巻き戻しはしない。更新後の状態を返す。
export async function recordRead(articleId: string, readAt: string): Promise<ArticlesState> {
  const current = await loadArticlesState();
  const next = withRead(current, articleId, readAt);
  if (next !== current) await saveArticlesState(next);
  return next;
}
