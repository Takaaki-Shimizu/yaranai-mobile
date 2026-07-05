// 日付境界: 朝4時切り替え。
// 「その日」は翌朝4時に終わる。深夜1時のスクロールは前日の失敗として記録される。
// サーバー側の yaranai_today() (SQL) と同じルール。端末時刻がJST前提(ドッグフード範囲)。
export function getTodayRecordDate(): string {
  const d = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
