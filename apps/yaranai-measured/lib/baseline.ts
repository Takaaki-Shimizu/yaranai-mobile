import { queryUsageBuckets } from '../modules/usage-stats';
import { DAY_MS } from './dates';
import {
  averageMinutesPerDay,
  coveredDaysOf,
  stitchBaselineWindow,
  type StitchedWindow,
} from './usage-buckets';

// 基準線は宣言時スナップショットで固定する(五原則3)。
// ローリング更新は禁止: 改善するほど取り戻し時間が目減りする=成功を罰する構造になるため。

export const BASELINE_MAX_DAYS = 84; // 12週
export const BASELINE_MIN_DAYS = 28; // これ未満なら宣言不可(機種変更直後など)

export type BaselineResult =
  | { status: 'insufficient'; availableDays: number }
  | { status: 'ok'; averageMinutesPerDay: number; windowDays: number };

export type BaselineWindow = {
  availableDays: number;
  window: StitchedWindow;
};

// 過去12週の集計窓を作る。観測画面(全アプリの12週平均)と宣言時の基準線が共用する。
//
// OSの保持期間は日次7日・週次4週・月次6ヶ月やけん、84日の窓は単一粒度では埋まらない。
// 日次→週次→月次の順に「窓の中から始まるバケット」だけを重複なしで継ぎ足し、
// 実際に集計できた期間(coveredMs)で割る。以前の queryAndAggregateUsageStats は
// 窓の外から始まる月次バケットまで丸ごと合算しとったけん、平均が膨らみえた。
export function measureBaselineWindow(now: number = Date.now()): BaselineWindow {
  const beginMs = now - BASELINE_MAX_DAYS * DAY_MS;
  const window = stitchBaselineWindow(
    {
      daily: queryUsageBuckets('daily', beginMs, now),
      weekly: queryUsageBuckets('weekly', beginMs, now),
      monthly: queryUsageBuckets('monthly', beginMs, now),
    },
    beginMs,
    now,
  );
  return { availableDays: coveredDaysOf(window), window };
}

// 宣言時に呼ぶ。過去12週(履歴が浅ければ集計できた日数)の1日平均(分)を返す。
// 観測画面に出とる12週平均と同じ計算やけん、見た数字がそのまま固定される。
export function computeBaseline(
  packageName: string,
  now: number = Date.now(),
): BaselineResult {
  const { availableDays, window } = measureBaselineWindow(now);
  if (availableDays < BASELINE_MIN_DAYS) {
    return { status: 'insufficient', availableDays };
  }
  return {
    status: 'ok',
    averageMinutesPerDay: averageMinutesPerDay(window, packageName),
    windowDays: availableDays,
  };
}
