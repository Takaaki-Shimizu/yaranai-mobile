// 週次開扉(§5.2)。庭モード(絵巻)は週の節目にのみ開く。
// 節目の定義: 日曜 0:00 〜 月曜 0:00 の暦日(端末ローカル。実測版は暦日境界)。
// 2026-07-07 に確認済み: 当日のみ開扉。
//
// 閉扉中に表示する一行。残り日数のカウントダウンやタイマーは出さない(非交渉ライン5)。

export const ENGAWA_CLOSED_MESSAGE = '次の縁側は、日曜に。';

export function isEngawaOpen(now: Date): boolean {
  return now.getDay() === 0;
}
