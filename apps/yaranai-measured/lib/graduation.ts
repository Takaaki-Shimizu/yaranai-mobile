// 誓いの「卒業」判定。純関数だけを置く(端末内DBの読み出しは usage-db.ts)。
//
// 卒業は成功でしか起きない。条件はただひとつ、「前日までの7暦日、一度も
// 使っていない」。挑戦中(使用が残っている)の誓いを外す手段は
// この機能のどこにも無い。負けているアプリを枠から下ろす逃げ道を作らんため。
//
// 窓に当日を含めない理由: 含めると「実質6日と数時間」の判定になるうえ、
// 当日の使用で成立が日中に消えたり現れたりして落ち着かん。確定した日だけで
// 判定し、成立は日付が変わった時点で定まる。窓の定義は lib/dates.ts の
// graduationWindowDates() に一本化する(observe の候補窓とは1日ずれる)。

export type GraduationInput = {
  /** 判定窓(前日までの7暦日・昇順)。dates.ts の graduationWindowDates() を渡す */
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
