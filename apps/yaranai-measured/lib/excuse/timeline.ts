// 宣言の完成演出のタイムライン(指示書 §4.2-3)。
// 起動演出(lib/launch/timeline.ts)と同じ2段構成 ── 光量が先、輪郭が後。
// 総尺は 2000ms 固定・有限。実機での微調整はこの1オブジェクトだけを触ればよい。
//
// reduce motion のときは一切再生せず、最終状態を即時に出す(§4.2-4)。

export const EXCUSE_REVEAL_TIMELINE = {
  /** 総尺。ここで最終状態(=カード表示画面と同じ絵)に落ち着く */
  total: 2000,
  /** 夜色の地(竹・石畳を含む背景)が先に現れる */
  ground: { delay: 0, duration: 700 },
  /** 灯りが灯る。文字より先に光量だけが立ち上がる */
  light: { delay: 450, duration: 950 },
  /** 宣言文・宣言日・預かりの一文・QR(輪郭の層)が浮かぶ */
  text: { delay: 1150, duration: 850 },
} as const;
