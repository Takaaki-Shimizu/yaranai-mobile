// 記事2(crashedDay)の発火判定(実装仕様書 §4)。純関数として閉じ、
// Supabase 参照や AsyncStorage は integration 層(evaluate.ts)に置く。
//
// 崩れた日の定義(§4.2)と発火判定(§4.3)をここで実装し、
// __tests__/trigger.test.ts が純関数として検証する。

import { DAY_MS } from '../dates';

// 昨日以前の「確定日」の実測1日ぶんを、判定に必要な形にまとめたもの。
export type VowMeasurement = {
  baselineMinutes: number; // 宣言時スナップショットの基準線
  actualMinutes: number; // その日の実測
};

// 誓いの素データ(measured_saved 相当)。有効判定に declared_on / discontinued_on を使う。
export type VowRecord = {
  vowId: string;
  baselineMinutes: number;
  declaredOn: string; // YYYY-MM-DD
  discontinuedOn: string | null; // YYYY-MM-DD or null
};

// 日次実測の素データ(measured_daily 相当)。
export type DailyRecord = {
  vowId: string;
  date: string; // YYYY-MM-DD
  actualMinutes: number;
};

// 確定日1日ぶん。判定に必要な最小情報だけを持つ。
export type ConfirmedDay = {
  date: string; // YYYY-MM-DD
  hasRow: boolean; // その日に measured_daily の行が1つでも存在するか(§4.2-1)
  activeVows: VowMeasurement[]; // その日時点で有効な誓いの実測(§4.2-2)
};

// 崩れた日は「今日から3暦日以内」のものだけ発火する(古い崩れを蒸し返さない・§4.3-2)。
export const CRASHED_DAY_MAX_AGE_DAYS = 3;

// D 時点で有効な誓い(§4.2-2)。
//   - 宣言が D より前(宣言前・宣言当日は対象外)
//   - まだ破棄されていない、または D より後に破棄された
export function activeVowsOn(date: string, vows: VowRecord[]): VowRecord[] {
  return vows.filter(
    (v) => v.declaredOn < date && (v.discontinuedOn === null || v.discontinuedOn > date),
  );
}

// その日の全誓い合計の取り戻し時間(分)。取り戻し = max(0, 基準線 − 実測)。
export function reclaimedMinutes(vows: VowMeasurement[]): number {
  return vows.reduce((sum, v) => sum + Math.max(0, v.baselineMinutes - v.actualMinutes), 0);
}

// 素データから確定日1日ぶんを組む。integration 層が Supabase から集めた行を渡す。
export function buildConfirmedDay(
  date: string,
  vows: VowRecord[],
  daily: DailyRecord[],
): ConfirmedDay {
  const dayRows = daily.filter((d) => d.date === date);
  const active = activeVowsOn(date, vows);
  const measurements: VowMeasurement[] = active.map((v) => {
    const row = dayRows.find((d) => d.vowId === v.vowId);
    // その日にデータがあれば、使わなかった誓いも 0 分の行が同期される。
    // 万一行が無い有効誓いは 0 分(=満額取り戻し)として扱い、崩れ判定を厳しくしない。
    return { baselineMinutes: v.baselineMinutes, actualMinutes: row ? row.actualMinutes : 0 };
  });
  return { date, hasRow: dayRows.length > 0, activeVows: measurements };
}

// D が「崩れた日」か(§4.2)。以下をすべて満たすとき true。
//   1. D に実測の行が存在する(データ欠損の日は対象外)
//   2. D 時点で有効な誓いが1本以上ある(宣言前・宣言当日は対象外)
//   3. D の全誓い合計の取り戻し時間が 0分
export function isCrashedDay(day: ConfirmedDay): boolean {
  if (!day.hasRow) return false;
  if (day.activeVows.length === 0) return false;
  return reclaimedMinutes(day.activeVows) === 0;
}

// 2つの record_date(YYYY-MM-DD)の暦日差 to − from。UTC 正午基準で丸めて DST を避ける。
export function calendarDaysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map((s) => parseInt(s, 10));
  const [ty, tm, td] = to.split('-').map((s) => parseInt(s, 10));
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  return Math.round((toMs - fromMs) / DAY_MS);
}

export type FireDecisionInput = {
  today: string; // YYYY-MM-DD(端末ローカルの今日)
  latestConfirmedDay: ConfirmedDay | null; // 最新の確定日(昨日以前)。無ければ null
  alreadyFired: boolean; // ArticlesState に記事2のエントリがあるか(§4.3-3)
};

// 記事2を発火するか(§4.3)。以下をすべて満たすとき true。
//   1. 最新の確定日が「崩れた日」である
//   2. その確定日が今日から 3暦日以内(未来日でもない)
//   3. 記事2が未発火
// 発火は生涯1回。クールダウン・回数上限の概念はない(常設モデル)。
export function shouldFireCrashedDay(input: FireDecisionInput): boolean {
  if (input.alreadyFired) return false;
  const day = input.latestConfirmedDay;
  if (day === null) return false;
  if (!isCrashedDay(day)) return false;
  const age = calendarDaysBetween(day.date, input.today);
  return age >= 0 && age <= CRASHED_DAY_MAX_AGE_DAYS;
}
