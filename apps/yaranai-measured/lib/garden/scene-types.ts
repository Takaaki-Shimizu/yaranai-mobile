// シーンスペック: レンダラ非依存の描画プリミティブ。
// scene.ts が成長パラメータから生成し、Skia レンダラと SVG プレビューが共通に消費する。

export type GradientStop = { offset: number; color: string; opacity?: number };

/** グラデーション座標は要素のバウンディングボックス相対(0〜1)。SVG の objectBoundingBox と同じ */
export type Paint =
  | { type: 'solid'; color: string }
  | { type: 'linear'; from: [number, number]; to: [number, number]; stops: GradientStop[] }
  | { type: 'radial'; center: [number, number]; radius: number; stops: GradientStop[] }
  | { type: 'ref'; name: string };

export type Transform = {
  tx?: number;
  ty?: number;
  scale?: number;
  rotateDeg?: number; // tx,ty 適用後の位置を中心に回転
};

export type Prim = { opacity?: number; blur?: number } & (
  | { kind: 'rect'; x: number; y: number; w: number; h: number; rx?: number; paint: Paint;
      rotate?: { deg: number; cx: number; cy: number } }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; paint: Paint; rotateDeg?: number }
  | { kind: 'circle'; cx: number; cy: number; r: number; paint: Paint }
  | { kind: 'path'; d: string; paint?: Paint; transform?: Transform;
      stroke?: { color: string; width: number; dash?: [number, number]; opacity?: number } }
  | { kind: 'polygon'; points: number[]; paint: Paint }
  // 苔の房ユニット(モックの <g id="tuft">)。レンダラ側で展開する
  | { kind: 'tuft'; x: number; y: number; scale: number; rotateDeg?: number; simple?: boolean }
);

export type Wobble = 'strong' | 'soft' | 'cobble';

export type SceneGroup = {
  wobble?: Wobble;
  blur?: number;
  opacity?: number;
  prims: Prim[];
};

export type SceneLayer = {
  id: string;
  /** パン追従係数(§5.2)。0 = ビューポート固定(粒子・ビネット) */
  parallax: number;
  groups: SceneGroup[];
};

export type Scene = {
  worldWidth: number;
  worldHeight: number;
  /** モック1200×800の中央パネルが占める世界座標の左端 */
  frameX: number;
  frameWidth: number;
  /** 縦ブリード用: これより上は空の色、下は大地の色で伸ばす */
  horizonY: number;
  /** 名前付きペイントの実体(field 等はパラメータ依存で毎回計算される) */
  paints: Record<string, Paint>;
  /** 描画順 = 配列順 */
  layers: SceneLayer[];
  /** 紙の粒子とビネットをビューポート全面に重ねる(常時 true) */
  overlay: { grain: boolean; vignette: boolean };
};
