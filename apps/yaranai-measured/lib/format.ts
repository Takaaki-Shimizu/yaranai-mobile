// 分数の表示は全画面共通でこの1本を通す。
// 60分未満は「42分」、60分以上は「2時間6分」(端数0分なら「2時間」)。
// 「実測0.9時間」と「基準線54分」が並ぶような単位の不揃いを避けるため。
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total}分`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}
