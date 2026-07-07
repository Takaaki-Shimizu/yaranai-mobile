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
