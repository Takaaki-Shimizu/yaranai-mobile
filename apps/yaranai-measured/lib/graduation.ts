// 誓いの「卒業」判定。純関数だけを置く(端末内DBの読み出しは graduation-check.ts)。
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
   * 丸めは isUsedDay() が持つ(ここは生のmsをそのまま渡す)。
   */
  foregroundMsByDate: ReadonlyMap<string, number>;
};

/**
 * その日、そのアプリを「使った」か。粒度は画面に出る数字と同じ ── 前景時間を
 * 分へ四捨五入して1分以上なら使った、0分なら使っていない。
 *
 * ms厳密(> 0)にしない理由: この機能が利用者に見せる数字はどこも分に四捨五入
 * しとる(誓い別詳細の「昨日の使用 0分」、日別の「+54分」、時間の行き先の
 * 「1日平均◯分」)。判定だけをmsで持つと、リンクのタップ・PiP・キャストで
 * 数秒だけ前面に出た日が「0分」の顔をしたまま卒業を恒久的に塞ぐ。利用者には
 * 7日連続0分に見えとるのに卒業の導線が現れん ── 何も嘘は言うとらんのに、
 * アプリが自分の見せた数字を裏切る。それが一番きつい。
 *
 * よって閾値は「表示が0分に見えるかどうか」に一致させる(= 30秒未満)。
 * 分への丸めは usage-db.ts の getMinutesForPackage と同じ式を使う。
 */
export function isUsedDay(foregroundMs: number): boolean {
  return Math.round(foregroundMs / 60000) > 0;
}

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
  return windowDates.every((d) => !isUsedDay(foregroundMsByDate.get(d) ?? 0));
}
