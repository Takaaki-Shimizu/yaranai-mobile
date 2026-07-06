import { queryUsageBuckets } from '../modules/usage-stats';
import { DAY_MS } from './dates';
import { coveredDaysOf, stitchBaselineWindow } from './usage-buckets';

// 基準線は宣言時スナップショットで固定する(五原則3)。
// ローリング更新は禁止: 改善するほど取り戻し時間が目減りする=成功を罰する構造になるため。

export const BASELINE_MAX_DAYS = 84; // 12週
export const BASELINE_MIN_DAYS = 28; // これ未満なら宣言不可(機種変更直後など)

export type BaselineResult =
  | { status: 'insufficient'; availableDays: number }
  | { status: 'ok'; averageMinutesPerDay: number; windowDays: number };

// 宣言時に呼ぶ。過去12週(履歴が浅ければ集計できた日数)の1日平均(分)を返す。
//
// OSの保持期間は日次7日・週次4週・月次6ヶ月やけん、84日の窓は単一粒度では埋まらない。
// 日次→週次→月次の順に「窓の中から始まるバケット」だけを重複なしで継ぎ足し、
// 実際に集計できた期間(coveredMs)で割る。以前の queryAndAggregateUsageStats は
// 窓の外から始まる月次バケットまで丸ごと合算しとったけん、平均が膨らみえた。
export function computeBaseline(
  packageName: string,
  now: number = Date.now(),
): BaselineResult {
  const beginMs = now - BASELINE_MAX_DAYS * DAY_MS;
  const stitched = stitchBaselineWindow(
    {
      daily: queryUsageBuckets('daily', beginMs, now),
      weekly: queryUsageBuckets('weekly', beginMs, now),
      monthly: queryUsageBuckets('monthly', beginMs, now),
    },
    beginMs,
    now,
  );
  const availableDays = coveredDaysOf(stitched);
  if (availableDays < BASELINE_MIN_DAYS) {
    return { status: 'insufficient', availableDays };
  }
  const totalMs = stitched.totalMsByPackage.get(packageName) ?? 0;
  // 分母は暦日数やなく、実際に集計できた時間。0.1分刻み。表示は画面側で丸める。
  const averageMinutesPerDay =
    Math.round((totalMs / 60000 / (stitched.coveredMs / DAY_MS)) * 10) / 10;
  return { status: 'ok', averageMinutesPerDay, windowDays: availableDays };
}
