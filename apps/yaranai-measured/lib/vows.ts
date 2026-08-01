// 手元におけるアクティブな誓いの上限。
// DB 側の制約(supabase/003_graduation.sql の check_measured_vow_limit トリガー)と
// 同じ値。UI 側で値を重複定義すると、片方だけ動いたときに気づけんため、
// 画面をまたぐ判定はここを参照する。
//
// 数えるのは「挑戦中」の誓いだけ ── discontinued_on is null and graduated_on is null。
// 卒業した誓いは枠から外れる(計測と取り戻しは続く)。枠が空くのは卒業だけで、
// 負けとる誓いを外す道は無い(卒業機能 §0)。
export const MAX_VOWS = 3;
