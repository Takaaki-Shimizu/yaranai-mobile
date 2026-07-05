// 実測版の日付境界は暦日(0時)。OSの日次集計バケットが暦日基準のため。
// 朝4時境界(申告版の yaranai_today と同じ)の再現は、UsageEvents から
// 前景時間を自前で積み上げる将来課題として残す。端末のローカル時刻が基準。

export const DAY_MS = 24 * 60 * 60 * 1000;

export function toRecordDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getTodayRecordDate(): string {
  return toRecordDate(new Date());
}

export function recordDateDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toRecordDate(d);
}

// record_date(YYYY-MM-DD)の 0時〜翌0時 をエポックmsで返す。
// 今日の場合、終端はまだ来とらんけん呼び出し側で now に丸めて使う。
export function dayRange(recordDate: string): { beginMs: number; endMs: number } {
  const [y, m, d] = recordDate.split('-').map((s) => parseInt(s, 10));
  const begin = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { beginMs: begin.getTime(), endMs: end.getTime() };
}
