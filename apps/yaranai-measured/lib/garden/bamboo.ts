// 借景の竹林(§変更1)。Day1 から完成形で固定表示し、成長パラメータに一切依存しない。
// north-star v3 Day84 の竹林(遠景稈・中景稈+節・林冠・舞い葉・手前の太竹)を
// そのまま定数として持つ。竹は増えない/生えてこない/ゴースト表示もしない。
//
// 座標はモックの 1200×800 系。世界座標へは wx() で +FRAME_X する。
// 左右の翼(絵巻の拡張分)の竹はシード付き乱数で決定論的に生成され、これも固定。

import { wx } from './dims';
import { GARDEN_COLORS as C } from './tokens';
import type { Paint, Prim, SceneLayer } from './scene-types';

// ---------------------------------------------------------------- 竹の定数(モック Day84)

// 遠景(靄の向こう)。[x, y, w, h, rot?, rotCx?, rotCy?]
const FAR_CULMS: number[][] = [
  [62, 70, 7, 360, -1.2, 65, 250], [132, 80, 6, 350], [212, 66, 8, 364, 1, 216, 250],
  [332, 78, 6, 352], [412, 70, 7, 360, -0.8, 415, 250], [502, 84, 6, 346],
  [592, 72, 7, 358, 0.9, 595, 250], [662, 80, 6, 350], [742, 68, 8, 362, -1, 746, 250],
  [832, 82, 6, 348], [912, 70, 7, 360, 1.1, 915, 250], [992, 78, 6, 352],
  [1072, 68, 8, 362, -0.9, 1076, 250], [1148, 80, 6, 350],
];

// 中景の竹(節つき)。{rot, rcx, rcy, x, y, w, h, nodes[]}
export type MidCulmSpec = {
  rot: number; rcx: number; rcy: number;
  x: number; y: number; w: number; h: number; nodes: number[];
};
const MID_CULMS: MidCulmSpec[] = [
  { rot: -1, rcx: 96, rcy: 240, x: 90, y: 40, w: 13, h: 400, nodes: [130, 230, 330] },
  { rot: 0.8, rcx: 266, rcy: 240, x: 260, y: 46, w: 14, h: 394, nodes: [150, 255, 360] },
  { rot: -0.6, rcx: 476, rcy: 240, x: 470, y: 42, w: 12, h: 398, nodes: [140, 245, 350] },
  { rot: 0.7, rcx: 646, rcy: 240, x: 640, y: 48, w: 13, h: 392, nodes: [155, 260, 365] },
  { rot: -0.9, rcx: 866, rcy: 240, x: 860, y: 44, w: 14, h: 396, nodes: [145, 250, 355] },
  { rot: 0.6, rcx: 1036, rcy: 240, x: 1030, y: 46, w: 13, h: 394, nodes: [150, 255, 360] },
];

// 手前の太竹(4本、節太め)
const NEAR_CULMS = [
  { rot: -1.4, rcx: 33, rcy: 230, x: 20, y: 0, w: 26, h: 460, nodes: [118, 238, 358], nh: 6 },
  { rot: 1, rcx: 165, rcy: 230, x: 155, y: 0, w: 19, h: 452, nodes: [132, 262, 392], nh: 5 },
  { rot: 1.3, rcx: 1133, rcy: 230, x: 1120, y: 0, w: 26, h: 460, nodes: [112, 232, 352], nh: 6 },
  { rot: -0.8, rcx: 1014, rcy: 230, x: 1005, y: 0, w: 18, h: 452, nodes: [128, 258, 388], nh: 5 },
];

// 梢。[cx, cy, rx, ry, color, opacity]
const CANOPY: [number, number, number, number, string, number][] = [
  [110, 30, 230, 88, C.canopyLight, 0.55], [430, 4, 260, 78, C.canopyDark, 0.8],
  [770, 24, 245, 84, C.canopyLight, 0.6], [1090, 42, 225, 90, C.canopyDark, 0.8],
  [270, 52, 150, 52, C.canopyMid, 0.45], [930, 60, 160, 50, C.canopyMid, 0.45],
];
// 舞い落ちる葉。[cx, cy, rx, ry, rot]
const CANOPY_LEAVES: [number, number, number, number, number][] = [
  [356, 128, 12, 3.4, -28], [540, 108, 11, 3, 18], [742, 140, 12, 3.4, -14],
  [208, 112, 10, 3, 24], [948, 122, 11, 3.2, -22],
];

// ---------------------------------------------------------------- 翼(左右拡張)の竹

/** scene.ts の buildWings が生成する竹関連の翼データ(世界座標) */
export type BambooWings = {
  farCulmsL: number[][];
  farCulmsR: number[][];
  midCulmsL: MidCulmSpec[];
  midCulmsR: MidCulmSpec[];
  canopyExtra: [number, number, number, number, string, number][];
};

// ---------------------------------------------------------------- 描画ヘルパ

const ref = (name: string): Paint => ({ type: 'ref', name });
const solid = (color: string): Paint => ({ type: 'solid', color });

// 翼の竹(座標は既に世界座標)
const culmRect = (c: number[], paint: Paint): Prim => ({
  kind: 'rect', x: c[0], y: c[1], w: c[2], h: c[3], paint,
});

// モックの竹(+FRAME_X して世界座標へ)
function mockCulmRect(c: number[], paint: Paint): Prim {
  return {
    kind: 'rect', x: wx(c[0]), y: c[1], w: c[2], h: c[3], paint,
    ...(c.length > 4 ? { rotate: { deg: c[4], cx: wx(c[5]), cy: c[6] } } : {}),
  };
}

function midCulmGroup(spec: MidCulmSpec, world: boolean): Prim[] {
  const X = world ? spec.x : wx(spec.x);
  const RCX = world ? spec.rcx : wx(spec.rcx);
  const rotate = { deg: spec.rot, cx: RCX, cy: spec.rcy };
  const prims: Prim[] = [{ kind: 'rect', x: X, y: spec.y, w: spec.w, h: spec.h, paint: ref('culmMid'), rotate }];
  for (const ny of spec.nodes) {
    prims.push({ kind: 'rect', x: X, y: ny, w: spec.w, h: 4, paint: solid(C.nodeMid), opacity: 0.6, rotate });
  }
  return prims;
}

// ---------------------------------------------------------------- レイヤー構築

/**
 * 竹林の3レイヤー(遠景・中景+林冠+葉・手前)を完成形で返す。
 * 成長パラメータを取らない = 常に同じ竹林。
 */
export function buildBambooLayers(wings: BambooWings): SceneLayer[] {
  // ---- 遠景の竹 (0.25)
  const far: SceneLayer = {
    id: 'bamboo-far', parallax: 0.25,
    groups: [
      {
        blur: 2.2, opacity: 0.38,
        prims: [
          ...FAR_CULMS.map((c) => mockCulmRect(c, solid(C.culmFar))),
          ...wings.farCulmsL.map((c) => culmRect(c, solid(C.culmFar))),
          ...wings.farCulmsR.map((c) => culmRect(c, solid(C.culmFar))),
        ],
      },
    ],
  };

  // ---- 中景の竹 + 梢 + 葉 (0.45)
  const canopyPrims: Prim[] = CANOPY.map(([cx, cy, rx, ry, color, op]) => ({
    kind: 'ellipse', cx: wx(cx), cy, rx, ry, paint: solid(color), opacity: op,
  }));
  for (const [cx, cy, rx, ry, color, op] of wings.canopyExtra) {
    canopyPrims.push({ kind: 'ellipse', cx, cy, rx, ry, paint: solid(color), opacity: op });
  }
  const leafPrims: Prim[] = CANOPY_LEAVES.map(([cx, cy, rx, ry, rot]) => ({
    kind: 'ellipse', cx: wx(cx), cy, rx, ry, rotateDeg: rot,
    paint: solid(C.canopyLight), opacity: 0.7,
  }));
  const mid: SceneLayer = {
    id: 'bamboo-mid', parallax: 0.45,
    groups: [
      {
        opacity: 0.85,
        prims: [
          ...MID_CULMS.flatMap((s) => midCulmGroup(s, false)),
          ...wings.midCulmsL.flatMap((s) => midCulmGroup(s, true)),
          ...wings.midCulmsR.flatMap((s) => midCulmGroup(s, true)),
        ],
      },
      { wobble: 'strong', prims: canopyPrims },
      { prims: leafPrims },
    ],
  };

  // ---- 手前の太竹 (0.8)。庭の縁に立つ
  const nearPrims: Prim[] = [];
  for (const spec of NEAR_CULMS) {
    const rotate = { deg: spec.rot, cx: wx(spec.rcx), cy: spec.rcy };
    nearPrims.push({ kind: 'rect', x: wx(spec.x), y: spec.y, w: spec.w, h: spec.h, paint: ref('culmNear'), rotate });
    for (const ny of spec.nodes) {
      nearPrims.push({ kind: 'rect', x: wx(spec.x), y: ny, w: spec.w, h: spec.nh, paint: solid(C.nodeNear), opacity: 0.65, rotate });
    }
  }
  const near: SceneLayer = {
    id: 'bamboo-near', parallax: 0.8,
    groups: [{ prims: nearPrims }],
  };

  return [far, mid, near];
}
