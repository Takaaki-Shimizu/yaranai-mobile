import { DAY_MS, dayRange, toRecordDate } from './dates';

// 最新期間の日次バケットの lastTimeStamp が、その暦日の終端(翌0時)からこの猶予を
// 超えてはみ出しとったら「その日1日ぶんの計測」として信用せん。端末が0時に起きとらんと
// OSの日次ロールが遅れ、[前日0時, now] の1本に前日と当日が混ざった生バケットが返る。
// これを firstTimeStamp の暦日(=前日)へ丸ごと足すと、前日の実測が当日ぶんだけ
// 水増しされ、当日を使うほど「戻ってきた時間(基準線−実測)」が減っていく。
// ロール直後の微妙なズレ(数分〜十数分)は正規の確定バケットなので許容する。
//
// この除外は「まだ伸び続けとる進行中バケット」だけが対象。進行中バケットは必ず
// firstTimeStamp が最大の期間やけん、それより古い期間のバケットには適用せん。
// ロールが朝まで遅れた端末では、確定済みの前日バケットも lastTimeStamp が翌朝
// (=翌0時+30分よりずっと後)で締まるのが正規の挙動で、これを終端だけ見て捨てると
// 前日のデータが恒久的に消え、「昨日の実測を待っています」から永遠に進まんくなる。
const DAY_END_SLACK_MS = 30 * 60 * 1000;

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
  // 進行中(未ロール)でありうるのは最新の期間だけ。期間はパッケージ共通で
  // firstTimeStamp を境界に持つけん、最大の firstTimeStamp で判定する。
  let latestPeriodStart = -Infinity;
  for (const b of buckets) {
    if (b.firstTimeStamp > latestPeriodStart) latestPeriodStart = b.firstTimeStamp;
  }
  const byDay = new Map<string, Map<string, number>>();
  for (const b of buckets) {
    if (b.totalForegroundMs <= 0) continue;
    const recordDate = toRecordDate(new Date(b.firstTimeStamp));
    if (!targetDates.has(recordDate)) continue;
    // 最新期間のバケットがその暦日の終端を大きく越えて伸びとったら、当日ぶんが
    // 混ざった未確定バケットとみなして捨てる(前日への水増しを防ぐ)。より新しい
    // 期間が始まっとるバケットは締め済み(もう伸びん)やけん、遅れて締まって
    // 終端がはみ出しとっても通す。lastTimeStamp が無い/0の古い端末も従来どおり通す。
    if (b.lastTimeStamp > 0 && b.firstTimeStamp === latestPeriodStart) {
      const { endMs } = dayRange(recordDate);
      if (b.lastTimeStamp > endMs + DAY_END_SLACK_MS) continue;
    }
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

// 指定アプリの1日平均(分)。分母は暦日数やなく、実際に集計できた時間。
// 0.1分刻み。基準線と観測画面の両方がこれを使う(数字は必ず一致させる)。
export function averageMinutesPerDay(window: StitchedWindow, packageName: string): number {
  if (window.coveredMs <= 0) return 0;
  const totalMs = window.totalMsByPackage.get(packageName) ?? 0;
  return Math.round((totalMs / 60000 / (window.coveredMs / DAY_MS)) * 10) / 10;
}
