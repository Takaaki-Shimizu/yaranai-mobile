// 理想(WHAT)の永続化層。
//
// 正本は Supabase の user_ideals(supabase/005_ideal.sql)。端末の AsyncStorage は
// オフライン表示用の写しでしかない。以前は端末が正本やったため、機種変更・再インストールで
// 掛け軸が空に戻っとった(復元フロー調査 Q5-1)。
//
// 写しのキーは user_id で分ける。理想は「なぜ時間を取り戻すのか」という個人の言葉で、
// 共用端末で前ユーザーのものが庭の直上に出続けるのは避けたいため。
// ログアウトでは消さない(再ログインで無傷に戻る)。
//
// サーバーの3状態を取り違えんこと:
//   行がある(本文あり) … 設定済み。これが正本
//   行がある(本文が空) … 本人が消した。端末の古い写しで復活させてはならない
//   行が無い           … まだ一度も設定していない、または未移行。ここだけ端末から押し上げる

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';

const keyFor = (userId: string) => `yaranai.ideal.v1:${userId}`;

async function readCache(userId: string): Promise<string> {
  try {
    return (await AsyncStorage.getItem(keyFor(userId))) ?? '';
  } catch {
    return '';
  }
}

async function writeCache(userId: string, text: string): Promise<void> {
  try {
    if (text === '') await AsyncStorage.removeItem(keyFor(userId));
    else await AsyncStorage.setItem(keyFor(userId), text);
  } catch {
    // 写しの失敗は表示に響かない(次回サーバーから読み直す)
  }
}

/** サーバーの取得結果。row が null = 行が無い(未設定・未移行) */
type ServerRead =
  | { ok: true; row: { text: string } | null }
  | { ok: false; reason: string };

async function fetchServer(userId: string): Promise<ServerRead> {
  const { data, error } = await supabase
    .from('user_ideals')
    .select('ideal_text')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { ok: false, reason: `${error.code ?? ''} ${error.message ?? ''}`.trim() };
  return { ok: true, row: data ? { text: (data.ideal_text as string) ?? '' } : null };
}

async function writeServer(userId: string, text: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_ideals')
    .upsert(
      { user_id: userId, ideal_text: text, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) {
    console.log(`[ideal] server write failed: ${error.code} ${error.message}`);
    return false;
  }
  return true;
}

/**
 * 端末の写し。描画の初手だけに使う。
 * サーバーの応答を待つ間、掛け軸が一度空白になるのを避けるためのもので、正本ではない。
 * これを出したあとは必ず loadIdeal() で正本に合わせ直すこと。
 */
export function loadCachedIdeal(userId: string): Promise<string> {
  return readCache(userId);
}

/**
 * 正本の理想。サーバーを引き、行が無ければ端末の値を押し上げる(既存ユーザーの移行)。
 *
 * 移行の完了フラグは持たない。この手続きは冪等で、何度走っても同じ結果になる
 * ── 一度上がればサーバーに行ができ、以後この分岐へは入らん。押し上げに失敗した回は
 * 次の読み込みでやり直す(端末の値は消さんけん失われはせん)。
 *
 * 取得に失敗した回は端末の写しをそのまま返し、書き込みは一切しない。
 * ここで空文字を返すと、圏外で開いただけで掛け軸が消えたように見える。
 */
export async function loadIdeal(userId: string): Promise<string> {
  const server = await fetchServer(userId);
  if (!server.ok) {
    console.log(`[ideal] server read failed: ${server.reason}`);
    return readCache(userId);
  }

  if (server.row) {
    // 本文が空の行も正本。端末に古い写しが残っとっても、消した事実のほうを採る
    await writeCache(userId, server.row.text);
    return server.row.text;
  }

  // 行が無い = 未移行。端末に言葉が残っとるなら、それがこの人の理想やけん上げる
  const local = await readCache(userId);
  if (local === '') return '';
  if (!(await writeServer(userId, local))) {
    // 握りつぶさず記録に残す。表示は端末の値のまま続け、次の読み込みでやり直す
    console.log('[ideal] migration to server failed; will retry on next load');
  }
  return local;
}

/**
 * 理想を保存する。空文字は「理想を消す」操作として通す(行は残し、本文だけ空にする)。
 *
 * サーバーへ書けなかったら false を返し、端末にも書かない ── 端末にだけ書いて
 * 保存できた顔をすると、次に別の端末で開いたとき言葉が無い。書けたかどうかを
 * そのまま呼び出し元へ返し、画面に伝えさせる。
 */
export async function saveIdeal(userId: string, text: string): Promise<boolean> {
  if (!(await writeServer(userId, text))) return false;
  await writeCache(userId, text);
  return true;
}
