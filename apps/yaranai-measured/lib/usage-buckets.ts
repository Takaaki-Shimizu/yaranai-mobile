import { DAY_MS, toRecordDate } from './dates';

// UsageStatsManager が返す生バケット。firstTimeStamp/lastTimeStamp はバケット期間。
// queryUsageStats は「範囲に重なるバケットを丸ごと」返すため(公式Docの既知挙動)、
// 範囲内かどうかの判定は呼び出し側がこのタイムスタンプで行う。ここがこの層の存在理由。
export type UsageBucket = {
  packageName: string;
  firstTimeStamp: number;
  lastTimeStamp: number;
  totalForegroundMs: number;
};

export type DailyAppUsage = {
  packageName: string;
  totalForegroundMs: number;
};

// INTERVAL_DAILY の生バケットを暦日ごとに合算する。
// バケットの帰属日は firstTimeStamp の暦日。targetDates に無い日のバケットは捨てる
// (=範囲外から混入したバケットを除外する。これが週次集計の膨張バグの修正点)。
// 再起動やタイムゾーン変更で同じ暦日に複数バケットができることがあるけん、合算する。
export function aggregateBucketsByDay(
  buckets: UsageBucket[],
  targetDates: ReadonlySet<string>,
): Map<string, DailyAppUsage[]> {
  const byDay = new Map<string, Map<string, number>>();
  for (const b of buckets) {
    if (b.totalForegroundMs <= 0) continue;
    const recordDate = toRecordDate(new Date(b.firstTimeStamp));
    if (!targetDates.has(recordDate)) continue;
    const perApp = byDay.get(recordDate) ?? new Map<string, number>();
    perApp.set(b.packageName, (perApp.get(b.packageName) ?? 0) + b.totalForegroundMs);
    byDay.set(recordDate, perApp);
  }
  const result = new Map<string, DailyAppUsage[]>();
  for (const [recordDate, perApp] of byDay) {
    result.set(
      recordDate,
      [...perApp].map(([packageName, totalForegroundMs]) => ({
        packageName,
        totalForegroundMs,
      })),
    );
  }
  return result;
}

export type StitchedWindow = {
  // 実際に集計できた時間(ms)。窓84日に対し、バケット境界の都合で欠けることがある。
  coveredMs: number;
  totalMsByPackage: Map<string, number>;
};

// 基準線(最長84日)用。日次は7日・週次は4週しか残らんけん、
// 日次 → 週次 → 月次の順に「窓の中から始まり、まだ数えとらん期間」のバケットだけを継ぎ足す。
//   - firstTimeStamp が窓の外のバケットは使わない(丸ごと混入する膨張を防ぐ)
//   - 細かい粒度で数えた期間に重なる粗いバケットも使わない(二重計上を防ぐ)
// 重なりで捨てた期間は coveredMs にも入らんけん、平均(合計÷coveredMs)は偏らない。
export function stitchBaselineWindow(
  buckets: { daily: UsageBucket[]; weekly: UsageBucket[]; monthly: UsageBucket[] },
  beginMs: number,
  endMs: number,
): StitchedWindow {
  const covered: { start: number; end: number }[] = [];
  const totalMsByPackage = new Map<string, number>();
  let coveredMs = 0;

  for (const level of [buckets.daily, buckets.weekly, buckets.monthly]) {
    // バケット期間は全パッケージ共通やけん、firstTimeStamp で期間にまとめてから判定する
    const periods = new Map<number, { start: number; end: number; rows: UsageBucket[] }>();
    for (const b of level) {
      const end = Math.min(b.lastTimeStamp, endMs);
      const period = periods.get(b.firstTimeStamp) ?? { start: b.firstTimeStamp, end, rows: [] };
      period.end = Math.max(period.end, end);
      period.rows.push(b);
      periods.set(b.firstTimeStamp, period);
    }
    const sorted = [...periods.values()].sort((a, b) => a.start - b.start);
    for (const period of sorted) {
      if (period.start < beginMs || period.start >= endMs) continue;
      if (period.end <= period.start) continue;
      if (covered.some((c) => period.start < c.end && c.start < period.end)) continue;
      covered.push({ start: period.start, end: period.end });
      coveredMs += period.end - period.start;
      for (const row of period.rows) {
        if (row.totalForegroundMs <= 0) continue;
        totalMsByPackage.set(
          row.packageName,
          (totalMsByPackage.get(row.packageName) ?? 0) + row.totalForegroundMs,
        );
      }
    }
  }
  return { coveredMs, totalMsByPackage };
}

export function coveredDaysOf(window: StitchedWindow): number {
  return Math.floor(window.coveredMs / DAY_MS);
}
