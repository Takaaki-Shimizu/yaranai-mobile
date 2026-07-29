// 完成演出を「次にカード画面が前に出たとき、一度だけ」流すための印(指示書 §4.2-3)。
//
// 儀式を終えた画面(excuse/new)は router.back() で戻るだけにして、演出の合図は
// この一度きりの印で渡す。URLのクエリで渡すと、スタックの積み方によっては
// 同じ画面が二重に積まれたり、戻ってくるたびに演出が再生されたりするため。
//
// 端末に残す必要はない(アプリを畳めば演出の機会も終わる)ので、メモリだけに持つ。

let pending = false;

/** 宣言が書けた直後に立てる */
export function markRevealPending(): void {
  pending = true;
}

/** カード画面が前に出たときに1回だけ true を返す */
export function consumeRevealPending(): boolean {
  const value = pending;
  pending = false;
  return value;
}
