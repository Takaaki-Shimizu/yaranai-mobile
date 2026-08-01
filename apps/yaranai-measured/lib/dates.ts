// 実測版の日付境界は暦日(0時)。端末のローカル時刻が基準。
// 日次の実測は UsageEvents から前景時間を自前で積み上げる(usage-events.ts)けん、
// 境界を朝4時(申告版の yaranai_today と同じ)へ寄せる余地は残っとるが、
// 基準線が使う日次バケット(INTERVAL_DAILY)が暦日基準のため0時に揃えとる。

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

// 「時間の行き先」の候補窓 = 卒業判定の窓。この2つは必ず同じ窓を見る。
// 「時間の行き先から消えた = 卒業できる」の厳密な一致がその機能のUXの核やけん、
// 窓の定義はこの1箇所だけに置き、observe も lib/graduation.ts もここを参照する。
export const RECENT_WINDOW_DAYS = 7;

// 直近7暦日の始まり(当日を含めて7日ぶん遡った日)。
export function recentWindowStart(): string {
  return recordDateDaysAgo(RECENT_WINDOW_DAYS - 1);
}

// 直近7暦日を昇順で。両端(6日前と当日)を含む。
export function recentWindowDates(): string[] {
  const dates: string[] = [];
  for (let i = RECENT_WINDOW_DAYS - 1; i >= 0; i--) dates.push(recordDateDaysAgo(i));
  return dates;
}

// サーバー側の既定(declared_on / graduated_on は Asia/Tokyo の暦日)と揃えるための日付。
// 端末のローカル時刻ではなく、必ず日本時間で切る ── 端末の時計が別のタイムゾーンでも
// 誓いの日付だけは1本の暦の上に載せておく。JSTは +9 固定でDSTがないので素で足せる。
export function getTodayTokyoDate(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// record_date(YYYY-MM-DD)の 0時〜翌0時 をエポックmsで返す。
// 今日の場合、終端はまだ来とらんけん呼び出し側で now に丸めて使う。
export function dayRange(recordDate: string): { beginMs: number; endMs: number } {
  const [y, m, d] = recordDate.split('-').map((s) => parseInt(s, 10));
  const begin = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { beginMs: begin.getTime(), endMs: end.getTime() };
}
