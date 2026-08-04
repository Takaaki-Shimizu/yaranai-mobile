// 庭のデータ読み込み: Supabase → GardenSnapshot → (高水位マージ) → GrowthParams。
//
//   石   = measured_saved の行数(やめた誓いも含む宣言の総数)
//   道   = measured_daily の distinct record_date 数
//   苔   = saved_minutes の合計(ビューが sum(greatest(0, 基準線 − 実測)) を返す)
//
// 高水位マークを端末に持ち、データ側の事故があっても庭が後退しない(非交渉ライン4)。

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import {
  deriveGrowth,
  mergeHighWater,
  type GardenSnapshot,
  type GrowthParams,
} from '../../lib/garden/growth';

const keyFor = (userId: string) => `garden-high-water:v1:${userId}`;
// 最後に庭を表示した時点の描画パラメータ(§変更4 入庭時の差分演出)
const seenKey = (userId: string) => `garden_last_seen_state:${userId}`;

/** 前回庭を表示した時点の状態(なければ null=初回) */
export async function loadLastSeen(userId: string): Promise<GrowthParams | null> {
  try {
    const raw = await AsyncStorage.getItem(seenKey(userId));
    return raw ? (JSON.parse(raw) as GrowthParams) : null;
  } catch {
    return null;
  }
}

/** 庭の表示完了時に、現在状態をスナップショットとして保存する */
export async function saveLastSeen(userId: string, g: GrowthParams): Promise<void> {
  try {
    await AsyncStorage.setItem(seenKey(userId), JSON.stringify(g));
  } catch {
    // 保存失敗は無視(次回は初回扱いで演出なし)
  }
}

// 開発者モード専用(§3): スライダー入力から直接 GrowthParams を組む。
// 高水位マージ(mergeHighWater)も AsyncStorage の high-water も通さない。
// デバッグ値で本番の高水位マークを汚染しないため、読み書きは一切しない。
// 石は Day1 完成・育たない要素なので固定 3。
export function buildGrowthFromDebug(days: number, savedHours: number): GrowthParams {
  const snapshot: GardenSnapshot = {
    stoneCount: 3,
    recordedDays: days,
    savedMinutes: savedHours * 60,
  };
  return deriveGrowth(snapshot);
}

/** 高水位マーク。読めんかった・まだ無いはどちらも null */
async function readHighWater(userId: string): Promise<GardenSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    return raw ? (JSON.parse(raw) as GardenSnapshot) : null;
  } catch {
    return null;
  }
}

/**
 * 庭の読み込み結果。
 *
 * 'unavailable' は「サーバーから引けず、高水位も無い」= 蓄積が分からん状態。
 * ここを 0 のスナップショットで代用してはならん ── 石が0本になると、ホームは
 * 庭を描かずに宣言前の空文言へ落ちる。圏外で開いただけで「まだ何も宣言しとらん」
 * 画面が出るのが、このアプリで一番やってはいけないことにあたる。
 */
export type GrowthResult =
  | { status: 'ok'; growth: GrowthParams }
  | { status: 'unavailable' };

export async function loadGrowth(userId: string): Promise<GrowthResult> {
  const [savedRes, daysRes] = await Promise.all([
    supabase.from('measured_saved').select('saved_minutes'),
    supabase.from('measured_daily').select('record_date'),
  ]);

  // 取得できんかった回は、空配列に落として 0 を作らない。
  // @supabase/postgrest-js は圏外でも例外を投げず {data: null, error} で返す
  // (2.105.1 の PostgrestBuilder が fetch の失敗を catch しとる)けん、
  // error を見んかぎり通信断は「値が0やった」と見分けがつかん。
  // ホーム(app/(app)/(tabs)/index.tsx)の誓い一覧が同じ事故を防いどるのと同じ扱いにする。
  if (savedRes.error || daysRes.error) {
    const reason = savedRes.error ?? daysRes.error;
    console.log(`[garden] load failed: ${reason?.code} ${reason?.message}`);
    // 高水位があるなら、最後に見せた庭をそのまま出す(後退させない)。
    // 失敗した回に高水位を書き戻すことはせん ── 書く理由が無い。
    const prev = await readHighWater(userId);
    return prev ? { status: 'ok', growth: deriveGrowth(prev) } : { status: 'unavailable' };
  }

  const vows = savedRes.data ?? [];
  const snapshot: GardenSnapshot = {
    stoneCount: vows.length,
    savedMinutes: vows.reduce((sum, v) => sum + Number(v.saved_minutes ?? 0), 0),
    recordedDays: new Set((daysRes.data ?? []).map((d) => d.record_date as string)).size,
  };

  const merged = mergeHighWater(await readHighWater(userId), snapshot);
  AsyncStorage.setItem(keyFor(userId), JSON.stringify(merged)).catch(() => {});
  return { status: 'ok', growth: deriveGrowth(merged) };
}
