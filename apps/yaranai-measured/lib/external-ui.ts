// 「アプリの中から開いた OS の画面」(共有シートなど)を開いとる間だけ立てる印。
//
// 共有シートを開くと Android では自分の Activity が背面に回り、AppState は
// background になる。けれど利用者にとっては、アプリの中で操作を続けとるだけで
// 外へ出たわけではない。共有せずに戻ったときに起動演出の静止画(_layout.tsx の
// still)が挟まると、アプリを離れて戻ってきたように見えてしまう ── 離れとらんのに。
//
// expo-sharing の約束(promise)はシートが閉じた時点で解ける(Android は
// onActivityResult でシートの結果を受けて解く)。なので
//  ・約束が解けるのを待っとる間
//  ・解けた直後のわずかな間(猶予。復帰イベントは約束の直後に届く)
// を印とし、その間の background→active 復帰では演出を挟まない。
//
// 送り先アプリを選んだときはシートが閉じた時点で約束が解けるけん、そのアプリから
// 戻ってくるころには印は消えとる ── 本当に外へ出て戻る復帰には、演出はちゃんと挟まる。

/** 印が消えるまでの猶予。復帰イベントは約束が解けた直後に届くので、ごく短くてよい */
export const EXTERNAL_UI_GRACE_MS = 1500;

/** 開いとる OS の画面の数(入れ子は想定せんが、数えておけば取りこぼさん) */
let open = 0;
/** 最後に閉じた時刻。0 = 閉じた直後ではない */
let closedAt = 0;

/**
 * 「アプリ内から開いた OS の画面から戻っただけ」か。
 * now はテスト用の差し込み口で、本番は既定の現在時刻でよい。
 */
export function isExternalUiReturn(now: number = Date.now()): boolean {
  if (open > 0) return true;
  return closedAt !== 0 && now - closedAt <= EXTERNAL_UI_GRACE_MS;
}

/**
 * run(OS の画面を開いて閉じるまで)の間、印を立てる。
 * 戻り値も例外もそのまま通す ── 呼び元の見え方は変えない。
 */
export async function withExternalUi<T>(run: () => Promise<T>): Promise<T> {
  open += 1;
  closedAt = 0;
  try {
    return await run();
  } finally {
    open -= 1;
    if (open === 0) closedAt = Date.now();
  }
}

/** テスト用。印を初期状態へ戻す */
export function resetExternalUiForTest(): void {
  open = 0;
  closedAt = 0;
}
