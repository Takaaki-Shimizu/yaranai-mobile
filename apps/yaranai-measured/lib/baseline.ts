import { queryUsage } from '../modules/usage-stats';
import { DAY_MS } from './dates';

// 基準線は宣言時スナップショットで固定する(五原則3)。
// ローリング更新は禁止: 改善するほど取り戻し時間が目減りする=成功を罰する構造になるため。

export const BASELINE_MAX_DAYS = 84; // 12週
export const BASELINE_MIN_DAYS = 28; // これ未満なら宣言不可(機種変更直後など)

export type BaselineResult =
  | { status: 'insufficient'; availableDays: number }
  | { status: 'ok'; averageMinutesPerDay: number; windowDays: number };

// 端末に残っとる履歴のおおよその日数。12週ぶんを1週間ずつの窓に割り、
// 使用実績のある最も古い窓から概算する(OSの保持期間は月次6ヶ月まで、
// ただし古い窓ほど週次・月次の粗いバケットで返る)。
export function measureAvailableHistoryDays(now: number = Date.now()): number {
  for (let week = BASELINE_MAX_DAYS / 7; week >= 1; week--) {
    const beginMs = now - week * 7 * DAY_MS;
    const endMs = now - (week - 1) * 7 * DAY_MS;
    if (queryUsage(beginMs, endMs).length > 0) {
      return Math.min(BASELINE_MAX_DAYS, week * 7);
    }
  }
  return 0;
}

// 宣言時に呼ぶ。過去12週(履歴が浅ければその日数)の1日平均(分)を返す。
export function computeBaseline(
  packageName: string,
  now: number = Date.now(),
): BaselineResult {
  const availableDays = measureAvailableHistoryDays(now);
  if (availableDays < BASELINE_MIN_DAYS) {
    return { status: 'insufficient', availableDays };
  }
  const windowDays = Math.min(BASELINE_MAX_DAYS, availableDays);
  const rows = queryUsage(now - windowDays * DAY_MS, now);
  const totalMs =
    rows.find((r) => r.packageName === packageName)?.totalForegroundMs ?? 0;
  // 0.1分刻み。表示は画面側で丸める。
  const averageMinutesPerDay =
    Math.round((totalMs / 60000 / windowDays) * 10) / 10;
  return { status: 'ok', averageMinutesPerDay, windowDays };
}
