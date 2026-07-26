// 起動演出のタイムライン(指示書 §4)。合計 2000ms 固定。
// 実機での微調整はこの1オブジェクトだけを触ればよい(§9)。
// 時刻はすべて演出開始(完全な黒の最初のフレーム)からの相対ms。

export const LAUNCH_TIMELINE = {
  /** 総尺。ここでホームへ(ロード未了なら最終フレームで静止して待つ §5) */
  total: 2000,
  /** 帳: 0–250ms は完全な黒、その後「夜明け」で opacity 1→0 */
  veil: { delay: 250, duration: 1350 },
  /** カメラ静定: scale 1.04→1.00。原点は消失点 */
  camera: { delay: 150, duration: 1850, from: 1.04 },
  /** 中心光(開口部=文字位置): opacity 0→peak(55%)→rest、scale 0.88→1 */
  core: { delay: 300, duration: 1300, peakAt: 0.55, peak: 0.9, rest: 0.58, scaleFrom: 0.88 },
  /** 側光(左下・右): opacity 0→peak(55%)→rest、translateY -8→+3px(シーン座標) */
  side: { delayLeft: 600, delayRight: 820, duration: 1100, peakAt: 0.55, peak: 0.6, rest: 0.36, liftFrom: -8, liftTo: 3 },
  /** 影の暈(文字の可読性の保険) */
  halo: { delay: 1000, duration: 800 },
  /** 題字グロー下層(ぼかしの発光層): 0→1→rest。「光量が先」 */
  glow: { delay: 1050, rise: 450, settle: 550, rest: 0.4 },
  /** 題字上層(シャープな文字): 「輪郭が後」 */
  title: { delay: 1150, duration: 500 },
  /** コピー「ここから、変わる。」 */
  copy: { delay: 1300, duration: 700, rest: 0.95 },
  /** 完了後、ホームを現すフェード(§4 の 200ms 程度) */
  homeFadeOut: 200,
  /** reduce motion 時: 最終状態を即時表示し、最低この時間静止(§6) */
  reducedHold: 500,
} as const;
