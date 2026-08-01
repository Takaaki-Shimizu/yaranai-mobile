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

// 「時間の行き先」の候補窓と卒業判定の窓。日数(7)はここで共有するが、窓は1日ずれる:
//   候補窓   = 当日を含む7暦日(今も続いとる習慣を見るけん、進行中の今日も入れる)
//   卒業判定 = 前日までの7暦日(当日を含めると「実質6日と数時間」の判定になり、
//              成立が日中の使用で揺れる。確定した日だけで判定する)
// 「消えた = 卒業できる」の対応は、窓の一致ではなく observe 側の免除
// (誓いのなかのアプリは足切りせず、1分でも使えば並び続ける)で保証する。
export const RECENT_WINDOW_DAYS = 7;

// 候補窓の始まり(当日を含めて7日ぶん遡った日)。
export function recentWindowStart(): string {
  return recordDateDaysAgo(RECENT_WINDOW_DAYS - 1);
}

// 候補窓の7暦日を昇順で。両端(6日前と当日)を含む。
export function recentWindowDates(): string[] {
  const dates: string[] = [];
  for (let i = RECENT_WINDOW_DAYS - 1; i >= 0; i--) dates.push(recordDateDaysAgo(i));
  return dates;
}

// 卒業判定の窓の始まり(前日を含めて7日ぶん遡った日)。
export function graduationWindowStart(): string {
  return recordDateDaysAgo(RECENT_WINDOW_DAYS);
}

// 卒業判定の7暦日を昇順で。両端(7日前と前日)を含み、当日は含まない。
export function graduationWindowDates(): string[] {
  const dates: string[] = [];
  for (let i = RECENT_WINDOW_DAYS; i >= 1; i--) dates.push(recordDateDaysAgo(i));
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
