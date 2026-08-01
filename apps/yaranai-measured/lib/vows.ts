// 手元におけるアクティブな誓いの上限。
// DB 側の制約(supabase/003_graduation.sql の check_measured_vow_limit トリガー)と
// 同じ値。UI 側で値を重複定義すると、片方だけ動いたときに気づけんため、
// 画面をまたぐ判定はここを参照する。
//
// 数えるのは「挑戦中」の誓いだけ ── discontinued_on is null and graduated_on is null。
// 卒業した誓いは枠から外れる(計測と取り戻しは続く)。枠が空くのは卒業だけで、
// 負けとる誓いを外す道は無い(卒業機能 §0)。
export const MAX_VOWS = 3;

// graduated_on はマイグレーション 003_graduation.sql で入る列。未適用の Supabase に
// 対して参照すると、クエリごと 42703(未定義の列)で落ちる。その一点を見分ける判定。
// 呼び出し側はこのとき列なしの旧スキーマとして引き直す ── 旧スキーマに卒業済みは
// 存在せんけん全行を挑戦中と扱えばよく、畳まれるのは卒業の導線だけで済む。
// ここで黙って空扱いにすると、計測中の誓いが初回モードに化ける(見た目のデータ消失)。
export function isMissingGraduatedOn(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  return error != null && (error.message ?? '').includes('graduated_on');
}
