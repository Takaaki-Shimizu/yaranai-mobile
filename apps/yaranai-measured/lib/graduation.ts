// 誓いの「卒業」判定。純関数だけを置く(端末内DBの読み出しは usage-db.ts)。
//
// 卒業は成功でしか起きない。条件はただひとつ、「直近7日、一度も使っていない」
// ── 時間の行き先から消えた状態。挑戦中(使用が残っている)の誓いを外す手段は
// この機能のどこにも無い。負けているアプリを枠から下ろす逃げ道を作らんため。
//
// 窓は observe の候補窓(getWeeklyTopApps(recentWindowStart(), ...))と同一。
// 「時間の行き先から消えた = 卒業できる」が厳密に一致することがUXの核なので、
// 窓の定義は lib/dates.ts に一本化し、両方がそこを参照する。

export type GraduationInput = {
  /** 判定窓(直近7暦日・昇順)。dates.ts の recentWindowDates() を渡す */
  windowDates: readonly string[];
  /** 窓内で端末内DBに1行でも観測がある日(=その日の記録が取れとる日) */
  recordedDates: ReadonlySet<string>;
  /**
   * 対象パッケージの日別前景時間(ms)。行が無い日はキーごと存在しない。
   * 分に丸めん理由: 丸めると数十秒の使用が0分になり、「1分も使っとらん」と
   * 「ちょっとだけ開いた」が同じ顔になる。卒業は前者にだけ許す。
   */
  foregroundMsByDate: ReadonlyMap<string, number>;
};

/**
 * 対象パッケージが卒業条件を満たすか。判定してよいのは active の誓いだけで、
 * graduated / discontinued には適用しない(呼び出し側で絞ること)。
 *
 * ガード: 窓内に観測行のある日が1日も無い場合(端末未使用・データ欠損)は不成立。
 * 「データが無い」と「使わなかった」を混同しない(usage-sync.ts の既存方針と同じ)。
 *
 * 逆に、一部の日だけ欠損しとって、記録のある日はすべて使用0なら成立とする。
 * 卒業は取り返しがつく(ぶり返せば計測に戻せる)けん、欠損に対しては
 * 卒業を許す側に倒す。
 */
export function computeGraduationEligibility(input: GraduationInput): boolean {
  const { windowDates, recordedDates, foregroundMsByDate } = input;
  if (!windowDates.some((d) => recordedDates.has(d))) return false;
  return windowDates.every((d) => (foregroundMsByDate.get(d) ?? 0) <= 0);
}
