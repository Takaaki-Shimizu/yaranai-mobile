// 庭の状態導出: データ → 成長パラメータ。
// 描画から完全に分離した純関数(§6)。テストは lib/__tests__/garden-growth.test.ts。
//
// データ対応(§4):
//   石   ← 断つ宣言(measured_vows、最大3)。Day 1 から完成状態
//   道   ← 実測記録が存在する日数 n(measured_daily の distinct record_date)
//   苔   ← 取り戻した時間の累計(measured_saved.saved_minutes の合計)
//   借景 ← 継続週数 w = floor(n / 7)。放置では育たない(2026-07-07 確認済み)
//   朱   ← w >= 12(Day 84 到達)

export const FULL_DAYS = 84; // 12週
export const FULL_WEEKS = 12;

// 苔の満開基準。garden_state ビューの規則(720時間 = 1.0)と同一。
export const MOSS_FULL_HOURS = 720;

// 庭に効く生データのスナップショット。単調非減少ガードの単位でもある。
export type GardenSnapshot = {
  /** 宣言された誓いの総数(やめた誓いも含む)。石は抜かない */
  stoneCount: number;
  /** 実測記録が存在する日数(誓い横断の distinct record_date) */
  recordedDays: number;
  /** 累計取り戻し時間(分)。日次で max(0, 基準線 − 実測) の累積 */
  savedMinutes: number;
};

export type GrowthParams = {
  /** 据わる石の数 1〜3(宣言前は 0) */
  stones: number;
  /** 記録日数(0〜84 に丸めない生値も保持) */
  recordedDays: number;
  /** 道の進行 0〜1(n / 84) */
  path: number;
  /** 継続週数 0〜12 */
  weeks: number;
  /** 苔の充実 0〜1(累計時間 / 720h) */
  moss: number;
  /** 朱のひとひら(Day 84 到達) */
  redLeaf: boolean;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function deriveGrowth(s: GardenSnapshot): GrowthParams {
  const days = Math.max(0, Math.floor(s.recordedDays));
  const weeks = Math.min(FULL_WEEKS, Math.floor(days / 7));
  return {
    stones: Math.min(3, Math.max(0, Math.floor(s.stoneCount))),
    recordedDays: days,
    path: clamp01(days / FULL_DAYS),
    weeks,
    moss: clamp01(s.savedMinutes / 60 / MOSS_FULL_HOURS),
    redLeaf: weeks >= FULL_WEEKS,
  };
}

// 単調非減少ガード(非交渉ライン4)。
// データ側の事故(誓いの削除・再同期での行消失など)があっても、
// 一度見せた蓄積より庭が後退しないよう高水位マークと合成する。
export function mergeHighWater(
  prev: GardenSnapshot | null,
  next: GardenSnapshot,
): GardenSnapshot {
  if (!prev) return next;
  return {
    stoneCount: Math.max(prev.stoneCount, next.stoneCount),
    recordedDays: Math.max(prev.recordedDays, next.recordedDays),
    savedMinutes: Math.max(prev.savedMinutes, next.savedMinutes),
  };
}
