// 庭の基本寸法(§0)。scene.ts と bamboo.ts が共有する。
// 座標系は mock v4(yaranai-crop-mock-v4)に一致させる:
//   絵巻全体 3300×1000、地平線 480、中央パネル(構図100%)= 世界座標 [900, 2400]、
//   左右の翼は各 900。中央パネルの比率は 1500:1000 = 3:2(north-star v3 と同じ)。
// ここは純粋な定数のみ(循環 import を避けるため描画ロジックは持たない)。

export const WORLD_W = 3300;
export const WORLD_H = 1000;
export const HORIZON_Y = 480; // mock v4 HZ
export const FRAME_X = 900; // 中央パネル左端(世界座標)= mock v4 CX0
export const FRAME_W = 1500; // 中央パネル幅 = mock v4 CW
export const FRAME_CX = FRAME_X + FRAME_W / 2; // 中央パネルの中心 = 1650

// north-star v3 は 1200×800(地平線 415)で作図されている。成長連動の描画資産
// (敷石・苔房・石・目地・結界)はその座標のまま持ち、以下の相似変換で新世界へ置く。
// 中央パネル [900,2400]×[0,1000] に、地平線を 415→480、底を 800→1000 で合わせる。
const NS_W = 1200;
const NS_H = 800;
const NS_HZ = 415;
export const NS_SCALE_X = FRAME_W / NS_W; // 1.25
export const NS_SCALE_Y = (WORLD_H - HORIZON_Y) / (NS_H - NS_HZ); // 520/385 ≈ 1.3506

/** north-star 1200 座標系の x → 世界座標 x */
export const wx = (x: number) => FRAME_X + x * NS_SCALE_X;
/** north-star 800 座標系(地平線 415)の y → 世界座標 y */
export const wy = (y: number) => HORIZON_Y + (y - NS_HZ) * NS_SCALE_Y;

/** north-star 作図資産を世界へ置く相似変換(paths 用)。translate 後に scale */
export const NS_TX = FRAME_X; // wx(0)
export const NS_TY = HORIZON_Y - NS_HZ * NS_SCALE_Y; // wy(0)
