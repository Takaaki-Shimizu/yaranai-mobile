// 誓い別詳細画面(アプリごとの取り戻しログ)の純関数。
// 軸は常に「取り戻し時間」。素の使用時間の推移はここでは扱わない。
//
// 値の定義(README の計算規則と同一):
//   日次取り戻し(per-app) = max(0, baseline_minutes − その日の実測分)
//   累計 = 宣言日から確定済み最終日(昨日)までの日次値の総和
// クリップは必ずアプリ(誓い)ごとに行う。誓いは1本ずつ独立した約束であり、
// 片方の超過をもう片方の節約で相殺しない(Supabase measured_saved ビューの
// sum(greatest(0, baseline − actual)) と同じ per-app クリップ)。
//
// 「記録なし」の意味論は usage-db.ts の hasAnyDataForDate に従う:
//   その日付にどのアプリの行も無い = 記録なし(欠測。0分と混同しない)
//   他アプリの行はあるが対象アプリの行が無い = 実測0分(基準線まるごと取り戻し)

import type { Lang } from './i18n/types';

// その日の値の3態。
//   saved: その日の値 > 0(取り戻した)
//   zero:  実測が確定しており、実測 ≥ 基準線(増えなかった。責めない)
//   none:  実測が確定していない(端末未起動・履歴切れ等。0分の濡れ衣を着せない)
export type VowDayState = 'saved' | 'zero' | 'none';

export type VowLogEntry = {
  /** record_date (YYYY-MM-DD) */
  date: string;
  state: VowDayState;
  /** その日の取り戻し(分)。zero / none は 0 */
  savedMinutes: number;
  /** 宣言日からこの日までの累計(分)。単調非減少 */
  cumulativeMinutes: number;
};

// per-app クリップの1日ぶん。baseline は宣言時スナップショット(numeric)を
// そのまま渡し、ここでは丸めない(丸めは表示時の formatMinutes に任せる。
// Supabase 側の saved_minutes も丸めずに合算しとるけん、丸めると検算がズレる)。
export function dailySavedMinutes(baselineMinutes: number, actualMinutes: number): number {
  return Math.max(0, baselineMinutes - actualMinutes);
}

// from〜to(両端含む)の record_date を昇順で列挙する。from > to なら空。
// ローカル暦日で1日ずつ進める(実測版の日付境界は暦日0時)。
export function listRecordDates(from: string, to: string): string[] {
  if (from > to) return [];
  const [y, m, d] = from.split('-').map((s) => parseInt(s, 10));
  const cursor = new Date(y, m - 1, d);
  const dates: string[] = [];
  for (;;) {
    const yy = cursor.getFullYear();
    const mm = String(cursor.getMonth() + 1).padStart(2, '0');
    const dd = String(cursor.getDate()).padStart(2, '0');
    const date = `${yy}-${mm}-${dd}`;
    if (date > to) break;
    dates.push(date);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export type BuildVowLogArgs = {
  /** 誓いの宣言日(YYYY-MM-DD)。これより前は基準線が無いため扱わない */
  declaredOn: string;
  /** 確定済み最終日 = 昨日(YYYY-MM-DD)。当日は未確定のため含めない */
  lastConfirmedDate: string;
  /** 宣言時スナップショットの基準線(分)。再計算しない */
  baselineMinutes: number;
  /** その日付に何かしらの実測行がある日(= hasAnyDataForDate が真の日) */
  recordedDates: ReadonlySet<string>;
  /** 対象アプリの日別実測(分)。行が無い日はキーごと無い */
  actualMinutesByDate: ReadonlyMap<string, number>;
};

// 宣言日から確定済み最終日までの日別ログを昇順で組む。
// 累計は単調非減少(zero / none の日は横ばいになるだけで、決して下がらない)。
export function buildVowLog(args: BuildVowLogArgs): VowLogEntry[] {
  const entries: VowLogEntry[] = [];
  let cumulative = 0;
  for (const date of listRecordDates(args.declaredOn, args.lastConfirmedDate)) {
    if (!args.recordedDates.has(date)) {
      entries.push({ date, state: 'none', savedMinutes: 0, cumulativeMinutes: cumulative });
      continue;
    }
    // 記録のある日に対象アプリの行が無い = そのアプリを開かんかった日(実測0分)。
    const actual = args.actualMinutesByDate.get(date) ?? 0;
    const saved = dailySavedMinutes(args.baselineMinutes, actual);
    cumulative += saved;
    entries.push({
      date,
      state: saved > 0 ? 'saved' : 'zero',
      savedMinutes: saved,
      cumulativeMinutes: cumulative,
    });
  }
  return entries;
}

// 累計(分)。ログが空(宣言当日など、確定日がまだ無い)なら 0。
export function totalSavedMinutes(entries: readonly VowLogEntry[]): number {
  return entries.length === 0 ? 0 : entries[entries.length - 1].cumulativeMinutes;
}

// Supabase measured_daily の1行(この画面が読むのは日付と実測分だけ)。
export type ServerDailyRow = {
  /** record_date (YYYY-MM-DD) */
  record_date: string;
  actual_minutes: number;
};

// サーバー行 → 日別ログ。ホームの累計(measured_saved ビュー)と同じ行を材料に
// 同じ規則(per-app クリップ)で組むけん、個別合計と総計の検算が構造的に一致する。
//
// 行の意味論は usage-sync.ts の書き込み規則そのまま:
//   行がある   = その日は端末に記録があった(開かんかった日も actual 0 の行が入る)
//   行がない   = 記録なし(欠測)。none として横ばいにする
export function buildVowLogFromDailyRows(args: {
  declaredOn: string;
  lastConfirmedDate: string;
  baselineMinutes: number;
  rows: readonly ServerDailyRow[];
}): VowLogEntry[] {
  return buildVowLog({
    declaredOn: args.declaredOn,
    lastConfirmedDate: args.lastConfirmedDate,
    baselineMinutes: args.baselineMinutes,
    recordedDates: new Set(args.rows.map((r) => r.record_date)),
    actualMinutesByDate: new Map(args.rows.map((r) => [r.record_date, r.actual_minutes])),
  });
}

export type StepChartPaths = {
  /** 階段の折れ線(SVGパス) */
  line: string;
  /** 折れ線の下を閉じた面(SVGパス) */
  area: string;
};

const px = (v: number) => String(Math.round(v * 100) / 100);

// 累積列 → 階段グラフのパス。y は下向き正(画面座標)で、0 起点・上限は最終累計。
// 入力の累積列が単調非減少である限り、出力の y は単調非増加(1pxたりとも下がらない)。
// 全日 0 のときは底辺に沿う一本の横線になる。
export function stepChartPaths(
  cumulative: readonly number[],
  width: number,
  height: number,
): StepChartPaths {
  const n = cumulative.length;
  if (n === 0) {
    const flat = `M0 ${px(height)}L${px(width)} ${px(height)}`;
    return { line: flat, area: `${flat}L0 ${px(height)}Z` };
  }
  const max = Math.max(1, cumulative[n - 1]);
  const y = (v: number) => height - (v / max) * height;
  const x = (i: number) => (i / n) * width;
  let d = `M0 ${px(height)}`;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    // その日の頭で段を上げ、日の幅ぶん横ばい(獲得0・記録なしの日は段が無い)
    if (cumulative[i] > prev) {
      d += `L${px(x(i))} ${px(y(cumulative[i]))}`;
      prev = cumulative[i];
    }
    d += `L${px(x(i + 1))} ${px(y(prev))}`;
  }
  return {
    line: d,
    area: `${d}L${px(width)} ${px(height)}L0 ${px(height)}Z`,
  };
}

// 宣言日の表記。ja: 2026年7月12日 / en: July 12, 2026
const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatFullDate(recordDate: string, lang: Lang): string {
  const [y, m, d] = recordDate.split('-').map((s) => parseInt(s, 10));
  if (lang === 'en') return `${EN_MONTHS[m - 1]} ${d}, ${y}`;
  return `${y}年${m}月${d}日`;
}

// 日別リスト・グラフ軸の表記。ja: 7月12日 / en: Jul 12
export function formatMonthDay(recordDate: string, lang: Lang): string {
  const [, m, d] = recordDate.split('-').map((s) => parseInt(s, 10));
  if (lang === 'en') return `${EN_MONTHS[m - 1].slice(0, 3)} ${d}`;
  return `${m}月${d}日`;
}
