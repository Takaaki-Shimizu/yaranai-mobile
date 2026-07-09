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

export async function loadGrowth(userId: string): Promise<GrowthParams> {
  const [savedRes, daysRes] = await Promise.all([
    supabase.from('measured_saved').select('saved_minutes'),
    supabase.from('measured_daily').select('record_date'),
  ]);
  const vows = savedRes.data ?? [];
  const snapshot: GardenSnapshot = {
    stoneCount: vows.length,
    savedMinutes: vows.reduce((sum, v) => sum + Number(v.saved_minutes ?? 0), 0),
    recordedDays: new Set((daysRes.data ?? []).map((d) => d.record_date as string)).size,
  };

  let prev: GardenSnapshot | null = null;
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (raw) prev = JSON.parse(raw) as GardenSnapshot;
  } catch {
    prev = null;
  }
  const merged = mergeHighWater(prev, snapshot);
  AsyncStorage.setItem(keyFor(userId), JSON.stringify(merged)).catch(() => {});
  return deriveGrowth(merged);
}
