// 庭の基本寸法(§0)。scene.ts と bamboo.ts が共有する。
// モックの 1200×800 が絵巻(3300×800)の中央パネルに収まる。
// ここは純粋な定数のみ(循環 import を避けるため描画ロジックは持たない)。

export const WORLD_W = 3300;
export const WORLD_H = 800;
export const FRAME_X = 1050; // モック中央パネルの左端(世界座標)
export const FRAME_W = 1200;
export const HORIZON_Y = 415;

/** モック 1200 座標系 → 世界座標(+FRAME_X) */
export const wx = (x: number) => x + FRAME_X;
