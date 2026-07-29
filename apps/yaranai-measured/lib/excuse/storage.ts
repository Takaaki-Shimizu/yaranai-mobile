// 言い訳カードの宣言の永続化層。
//
// 正本はSupabase(復元フローのA分類 §2-6)。カード宣言はアンインストールで消えてはならない
// ため、庭の高水位や理想と違って端末を正本にしない。
//
// ただし、宣言できないことのほうが重い ── 宣言は発話であって、サーバーの都合で
// 発話が止まってはならない。書き込みは3段のはしごで必ずどこかに立つ:
//
//   1. declare_excuse() RPC … 旧行の superseded 化と新行の挿入を1トランザクションで。
//   2. テーブルへ直に書く   … RPCが無い・使えない環境(002_excuse_declarations.sql が
//                             未投入・投入が途中で落ちた・スキーマキャッシュ未更新)の代替。
//   3. 端末に書く           … サーバーにどうしても届かないとき(スキーマが丸ごと無い・
//                             圏外・認証切れ)。pending の印を付けて掲げ、次に開いたとき
//                             サーバーへ押し直す。正本には遅れて追いつく。

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';
import type { CardSize } from './card-spec';

export type ExcuseDeclaration = {
  id: string;
  whatText: string;
  /** YYYY-MM-DD(Asia/Tokyo の暦日。サーバーが打つ。端末預かりの間だけ端末が打つ) */
  declaredOn: string;
  /** サーバー未達の印。次の読み込みで押し直し、届いたら消える */
  pending?: boolean;
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
 * 端末預かり(pending)の宣言が残っていれば、まずサーバーへ押し直す。
 */
export async function loadCurrentDeclaration(userId: string): Promise<ExcuseDeclaration | null> {
  const cached = await readCache(userId);

  // 端末にしか無い宣言はサーバーの読み値より新しい。先に押し直し、
  // 届くまではサーバーの行で上書きしない(掲げた宣言を引っ込めない)
  if (cached?.pending) {
    const pushed = await declareToServer(userId, cached.whatText);
    if (pushed.row) {
      const declaration = toDeclaration(pushed.row);
      await writeCache(userId, declaration);
      return declaration;
    }
    return cached;
  }

  const { data, error } = await supabase
    .from('excuse_declarations')
    .select('id, what_text, declared_on')
    .is('superseded_at', null)
    .maybeSingle();

  if (error) return cached;

  const declaration = data ? toDeclaration(data as Row) : null;
  await writeCache(userId, declaration);
  return declaration;
}

/** 書けなかったときは理由も返す。画面には出さないが、原因の切り分けに要る */
export type DeclareResult =
  | { ok: true; declaration: ExcuseDeclaration }
  | { ok: false; reason: string };

type PostgrestError = { code?: string; message?: string; details?: string; hint?: string };

const describe = (error: PostgrestError | null): string =>
  [error?.code, error?.message].filter(Boolean).join(' ') || 'unknown error';

/**
 * RPCが使えないときの代替。トランザクションにならないので、
 * 差し替えの途中で落ちたら現行が0枚になり得る ── 拾えたら元に戻す。
 */
async function declareWithoutRpc(
  userId: string,
  whatText: string,
): Promise<{ row: Row | null; reason: string }> {
  const { data: current } = await supabase
    .from('excuse_declarations')
    .select('id')
    .is('superseded_at', null);
  const supersededIds = ((current ?? []) as { id: string }[]).map((r) => r.id);

  if (supersededIds.length > 0) {
    const { error } = await supabase
      .from('excuse_declarations')
      .update({ superseded_at: new Date().toISOString() })
      .in('id', supersededIds);
    if (error) return { row: null, reason: describe(error) };
  }

  const { data, error } = await supabase
    .from('excuse_declarations')
    .insert({ user_id: userId, what_text: whatText })
    .select('id, what_text, declared_on')
    .single();

  if (error || !data) {
    // 新しい宣言が立たんかったので、掲げていた宣言を掲げ直す(0枚のまま残さない)
    if (supersededIds.length > 0) {
      await supabase
        .from('excuse_declarations')
        .update({ superseded_at: null })
        .in('id', supersededIds);
    }
    return { row: null, reason: describe(error) };
  }
  return { row: data as Row, reason: '' };
}

/**
 * サーバーへの書き込み(はしごの1〜2段目)。まず declare_excuse() RPC、
 * だめならテーブルへ直に書く。RPC の失敗理由は問わない ── 関数が無いときに限らず、
 * 権限や定義の食い違いで落ちても、直書きが通るなら宣言は立ったほうがよい
 * (RPC は1トランザクションなので、途中で落ちても書き残しは無い)。
 */
async function declareToServer(
  userId: string,
  whatText: string,
): Promise<{ row: Row | null; reason: string }> {
  const { data, error } = await supabase.rpc('declare_excuse', { p_what_text: whatText });
  // RPC は returns excuse_declarations なので単一行が返る
  const row = (Array.isArray(data) ? data[0] : data) as Row | undefined | null;
  if (row) return { row, reason: '' };

  const reason = error ? describe(error) : 'empty response';
  const fallback = await declareWithoutRpc(userId, whatText);
  if (fallback.row) return { row: fallback.row, reason: '' };
  return { row: null, reason: `${reason} / ${fallback.reason}` };
}

/** 端末預かりの宣言日。Asia/Tokyo は夏時間が無いので UTC+9 固定で足りる */
function todayInTokyo(): string {
  const t = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/**
 * 宣言の作成・差し替え。旧宣言は削除せず superseded 化される(§2-1)。
 * サーバーに届かなくても宣言は立つ ── 発話はもう済んでいる。端末に pending で預け、
 * 次に開いたとき(loadCurrentDeclaration)サーバーへ押し直す。
 */
export async function declareExcuse(
  userId: string,
  whatText: string,
): Promise<DeclareResult> {
  const server = await declareToServer(userId, whatText);
  if (server.row) {
    const declaration = toDeclaration(server.row);
    await writeCache(userId, declaration);
    return { ok: true, declaration };
  }

  // はしごの3段目: 端末に預ける。原因(スキーマ未投入・圏外など)はログへ回す
  console.warn('[excuse] declare falling back to device:', server.reason);
  const declaration: ExcuseDeclaration = {
    id: `local-${Date.now().toString(36)}`,
    whatText,
    declaredOn: todayInTokyo(),
    pending: true,
  };
  await writeCache(userId, declaration);
  return { ok: true, declaration };
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
