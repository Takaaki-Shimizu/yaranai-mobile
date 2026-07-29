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
  // 実際に集計できた時間(ms)= 返ってきたバケット期間の和集合 ∩ 窓。
  // 端末の履歴が窓より浅いときだけ84日を下回る(バケット境界では欠けない)。
  coveredMs: number;
  totalMsByPackage: Map<string, number>;
};

type Span = { start: number; end: number };

// 採用済みの区間。互いに重ならない。byPackage は「この区間へ割り当てた前景ms」で、
// 粗いバケットの残差(まだ数えとらんぶん)を出すときに差し引く元になる。
type AcceptedSpan = Span & { byPackage: Map<string, number> };

type LevelPeriod = Span & { rows: UsageBucket[] };

function spanMsOf(spans: readonly Span[]): number {
  return spans.reduce((sum, s) => sum + (s.end - s.start), 0);
}

function overlapMs(a: Span, b: Span): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

// 同じレベルの中で期間が重なるバケットを1つの期間へ併合する。
// バケット期間は本来パッケージ共通やけど、端末によっては同じ日でもパッケージごとに
// first/last がずれて返ったり、ロール遅延のあと当日バケットが0時起点へ遡って作られて
// 前日バケットと重なったりする。併合すれば、どのバケットもちょうど1回だけ数えられる。
function mergeLevelPeriods(level: UsageBucket[], endMs: number): LevelPeriod[] {
  const sorted = [...level].sort((a, b) => a.firstTimeStamp - b.firstTimeStamp);
  const periods: LevelPeriod[] = [];
  for (const b of sorted) {
    const end = Math.min(b.lastTimeStamp, endMs);
    if (end <= b.firstTimeStamp) continue;
    const last = periods[periods.length - 1];
    if (last && b.firstTimeStamp < last.end) {
      last.end = Math.max(last.end, end);
      last.rows.push(b);
    } else {
      periods.push({ start: b.firstTimeStamp, end, rows: [b] });
    }
  }
  return periods;
}

// span のうち、まだどの採用区間にも覆われとらん部分を返す。
function uncoveredPartsOf(span: Span, accepted: readonly AcceptedSpan[]): Span[] {
  const blockers = accepted
    .filter((a) => overlapMs(a, span) > 0)
    .sort((a, b) => a.start - b.start);
  const gaps: Span[] = [];
  let cursor = span.start;
  for (const b of blockers) {
    if (b.start > cursor) gaps.push({ start: cursor, end: Math.min(b.start, span.end) });
    cursor = Math.max(cursor, b.end);
    if (cursor >= span.end) break;
  }
  if (cursor < span.end) gaps.push({ start: cursor, end: span.end });
  return gaps.filter((g) => g.end > g.start);
}

// span の中で、そのパッケージに既に割り当て済みの前景ms。
// 採用区間が span の境界をまたぐとき(月をまたぐ週次など)は時間比で按分する。
function attributedWithin(
  accepted: readonly AcceptedSpan[],
  packageName: string,
  span: Span,
): number {
  let total = 0;
  for (const a of accepted) {
    const ms = a.byPackage.get(packageName);
    if (!ms) continue;
    const length = a.end - a.start;
    if (length <= 0) continue;
    total += ms * (overlapMs(a, span) / length);
  }
  return total;
}

// 基準線(最長84日)用。日次は7日・週次は4週しか残らんけん、
// 日次 → 週次 → 月次の順に、まだ覆えとらん期間を継ぎ足して12週の窓を埋める。
//
// 粗いバケットは「丸ごと採る/丸ごと捨てる」のどちらもやらない。捨てると、その期間の
// 実測ごと消えるうえに coveredMs が7日・30日単位でガクンと動き、しきい値(28日)の
// near で日によって出たり消えたりする。丸ごと採ると細かい粒度と二重計上になる。
// かわりに、期間の重なった部分だけを差し引いた残差を、覆えとらん部分へ配る:
//
//   残差 = バケット合計 × 窓で切った割合 − その期間に割り当て済みのぶん
//
// 月次バケットの合計はその月の全ての日を含むけん、既に日次・週次で数えた日ぶんを
// 引けば、残りは「まだ数えとらん日」の実測になる(粒度が入れ子やけん引き算が成り立つ)。
// これで coveredMs は「返ってきたバケット期間の和集合 ∩ 窓」に一致し、採る順序にも
// バケット境界と今日の位置関係にも左右されんくなる。
//
// 窓の縁(84日前)をまたぐバケットは、捨てずに窓で切って時間比で落とす。丸ごと足すと
// 平均が膨らみ(#d0cd8ee で直した膨張バグ)、丸ごと捨てると beginMs が月境界を越えた
// 日に30日ぶんの覆いが一気に消える。切って按分すれば、どちらの段差も出ない。
export function stitchBaselineWindow(
  buckets: { daily: UsageBucket[]; weekly: UsageBucket[]; monthly: UsageBucket[] },
  beginMs: number,
  endMs: number,
): StitchedWindow {
  const accepted: AcceptedSpan[] = [];

  for (const level of [buckets.daily, buckets.weekly, buckets.monthly]) {
    for (const period of mergeLevelPeriods(level, endMs)) {
      const periodMs = period.end - period.start;
      if (periodMs <= 0) continue;
      const clipped: Span = {
        start: Math.max(period.start, beginMs),
        end: Math.min(period.end, endMs),
      };
      if (clipped.end <= clipped.start) continue;
      const clipRatio = (clipped.end - clipped.start) / periodMs;

      const gaps = uncoveredPartsOf(clipped, accepted);
      const gapMs = spanMsOf(gaps);
      if (gapMs <= 0) continue; // 期間は既に細かい粒度で埋まっとる。数え直さん

      const periodTotals = new Map<string, number>();
      for (const row of period.rows) {
        if (row.totalForegroundMs <= 0) continue;
        periodTotals.set(
          row.packageName,
          (periodTotals.get(row.packageName) ?? 0) + row.totalForegroundMs,
        );
      }
      const residuals = new Map<string, number>();
      for (const [packageName, total] of periodTotals) {
        const residual = total * clipRatio - attributedWithin(accepted, packageName, clipped);
        if (residual > 0) residuals.set(packageName, residual);
      }
      // 残差は覆えとらん部分へ、長さの比で配る(どこで使われたかまでは分からんため)
      for (const gap of gaps) {
        const share = (gap.end - gap.start) / gapMs;
        const byPackage = new Map<string, number>();
        for (const [packageName, residual] of residuals) {
          byPackage.set(packageName, residual * share);
        }
        accepted.push({ ...gap, byPackage });
      }
    }
  }

  const totalMsByPackage = new Map<string, number>();
  let coveredMs = 0;
  for (const span of accepted) {
    coveredMs += span.end - span.start;
    for (const [packageName, ms] of span.byPackage) {
      totalMsByPackage.set(packageName, (totalMsByPackage.get(packageName) ?? 0) + ms);
    }
  }
  // 按分で端数が出るけん、外へ出す前に ms 単位へ丸める
  for (const [packageName, ms] of totalMsByPackage) {
    totalMsByPackage.set(packageName, Math.round(ms));
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
