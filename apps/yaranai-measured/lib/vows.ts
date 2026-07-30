// 手元におけるアクティブな誓いの上限。
// DB 側の制約(supabase/001_schema.sql の check_measured_vow_limit トリガー)と
// 同じ値。UI 側で値を重複定義すると、片方だけ動いたときに気づけんため、
// 画面をまたぐ判定はここを参照する。
export const MAX_VOWS = 3;
