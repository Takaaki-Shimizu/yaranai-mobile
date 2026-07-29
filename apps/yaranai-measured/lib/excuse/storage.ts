// 言い訳カードの宣言の永続化層。
//
// 正本はSupabase(復元フローのA分類 §2-6)。カード宣言はアンインストールで消えてはならない
// ため、庭の高水位や理想と違って端末を正本にしない。AsyncStorage はあくまで
// オフライン時に掲げておくためのキャッシュで、書き込みは必ずサーバーを通る。
//
// 差し替えは declare_excuse() RPC 経由。旧行の superseded 化と新行の挿入を
// クライアントで2回に分けると、間で失敗したとき現行が0枚になり得るため。

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';
import type { CardSize } from './card-spec';

export type ExcuseDeclaration = {
  id: string;
  whatText: string;
  /** YYYY-MM-DD(Asia/Tokyo の暦日。サーバーが打つ) */
  declaredOn: string;
};

const cacheKey = (userId: string) => `yaranai.excuse.current.v1:${userId}`;

type Row = { id: string; what_text: string; declared_on: string };

const toDeclaration = (row: Row): ExcuseDeclaration => ({
  id: row.id,
  whatText: row.what_text,
  declaredOn: row.declared_on,
});

async function writeCache(userId: string, value: ExcuseDeclaration | null): Promise<void> {
  try {
    if (value) await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(value));
    else await AsyncStorage.removeItem(cacheKey(userId));
  } catch {
    // キャッシュの失敗は表示に響かない(次回サーバーから読み直す)
  }
}

async function readCache(userId: string): Promise<ExcuseDeclaration | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    return raw ? (JSON.parse(raw) as ExcuseDeclaration) : null;
  } catch {
    return null;
  }
}

/**
 * 現行の宣言(superseded_at is null の1件)。
 * サーバーに届かなかったときはキャッシュを返す ── 掲げた宣言は、圏外でも掲げたままにする。
 */
export async function loadCurrentDeclaration(userId: string): Promise<ExcuseDeclaration | null> {
  const { data, error } = await supabase
    .from('excuse_declarations')
    .select('id, what_text, declared_on')
    .is('superseded_at', null)
    .maybeSingle();

  if (error) return readCache(userId);

  const declaration = data ? toDeclaration(data as Row) : null;
  await writeCache(userId, declaration);
  return declaration;
}

/**
 * 宣言の作成・差し替え。旧宣言は削除せず superseded 化される(§2-1)。
 * 書けたら新しい宣言を、書けなかったら null を返す。
 */
export async function declareExcuse(
  userId: string,
  whatText: string,
): Promise<ExcuseDeclaration | null> {
  const { data, error } = await supabase.rpc('declare_excuse', { p_what_text: whatText });
  if (error || !data) return null;
  // RPC は returns excuse_declarations なので単一行が返る
  const row = (Array.isArray(data) ? data[0] : data) as Row | undefined;
  if (!row) return null;
  const declaration = toDeclaration(row);
  await writeCache(userId, declaration);
  return declaration;
}

/**
 * 本人だけが見られる履歴(§2-1)。新しい順。現行の1件も含む。
 * いまは画面を持たないが、正本が残っていることの確認に使える。
 */
export async function loadDeclarationHistory(): Promise<ExcuseDeclaration[]> {
  const { data, error } = await supabase
    .from('excuse_declarations')
    .select('id, what_text, declared_on')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as Row[]).map(toDeclaration);
}

/**
 * 共有の記録(§6)。サイズ種別だけを残し、共有先アプリ名は取得しない。
 * 失敗しても共有そのものは成立しているので、投げっぱなしでよい。
 */
export function logCardShared(userId: string, size: CardSize): void {
  supabase
    .from('app_events')
    .insert({ user_id: userId, event: 'excuse_card_shared', payload: { size } })
    .then(() => {}, () => {});
}
