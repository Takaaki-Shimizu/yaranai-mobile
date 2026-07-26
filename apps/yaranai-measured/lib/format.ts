// 分数の表示は全画面共通でこの1本を通す。
// 日本語: 60分未満は「42分」、60分以上は「2時間6分」(端数0分なら「2時間」)。
// 英語:   60分未満は「42 min」、60分以上は「2 hr 6 min」(端数0分なら「2 hr」)。
// 「実測0.9時間」と「基準線54分」が並ぶような単位の不揃いを避けるため。

import type { Lang } from './i18n/types';

export function formatMinutes(minutes: number, lang: Lang = 'ja'): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (lang === 'en') {
    if (total < 60) return `${total} min`;
    return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
  }
  if (total < 60) return `${total}分`;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}
