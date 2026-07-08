// 借景の竹林(§変更1・§変更4)。Day1 から完成形で固定表示し、成長パラメータに依存しない。
// 竹は増えない/生えてこない/ゴースト表示もしない。
//
// §変更4「連続深度」: 2層構造(手前=濃い/奥=薄い)を廃止し、全ての稈が深度 t(0=最前〜
// 1=最奥)を1本ずつ持つ。太さ・背の高さ・グラデーションの彩度・節の見え方・靄の被り・
// 全体不透明度が t で連続的に変わる。座標と深度分布は mock v4 の centerCulms を移植。
//
// 座標は mock v4 の世界座標(3300×1000、地平線 480)そのまま。北星の 1200 系ではない。

import { HORIZON_Y, WORLD_H, WORLD_W } from './dims';
import { mulberry32, type Rng } from './prng';
import { GARDEN_COLORS as C } from './tokens';
import type { Paint, Prim, SceneLayer } from './scene-types';

const ref = (name: string): Paint => ({ type: 'ref', name });
const solid = (color: string): Paint => ({ type: 'solid', color });

// ---------------------------------------------------------------- 色ヘルパ(節・稈色の深度混色)

const hex2rgb = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16),
];
/** a を b へ t 混色(mock v4 mix と同じ) */
export function mix(a: string, b: string, t: number): string {
  const A = hex2rgb(a), B = hex2rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------- 深度バケツ(全稈がグラデを持つ)

export const N_BUCKETS = 6;
/** 深度バケツごとの稈グラデーション(cg0..cg5)。scene.ts が paints に登録する */
export function culmBucketPaints(): Record<string, Paint> {
  const out: Record<string, Paint> = {};
  for (let b = 0; b < N_BUCKETS; b++) {
    const t = b / (N_BUCKETS - 1);
    const tt = Math.pow(t, 0.92);
    const s = C.culmStops.map((c) => mix(c, C.culmMist, tt * 0.88));
    out[`cg${b}`] = {
      type: 'linear', from: [0, 0], to: [1, 0],
      stops: [
        { offset: 0, color: s[0] }, { offset: 0.55, color: s[1] }, { offset: 1, color: s[2] },
      ],
    };
  }
  return out;
}
const bucketOf = (t: number) => Math.min(N_BUCKETS - 1, Math.round(t * (N_BUCKETS - 1)));

// ---------------------------------------------------------------- 稈の描画(mock v4 culmD 移植)

/** 1本の稈を深度 t で描く。cx は稈の左端 x(世界座標)。rng はジッター用 */
function culmPrims(cx: number, t: number, rng: Rng): Prim[] {
  const w = 26 - (26 - 4.5) * t + (rng() - 0.5) * 3;
  const yTop = -30 + 120 * t + (rng() - 0.5) * 36;
  const yBot = HORIZON_Y + (56 - 48 * t) + (rng() - 0.5) * 10;
  const b = bucketOf(t);
  const op = 1 - 0.62 * Math.pow(t, 1.15);
  const prims: Prim[] = [
    { kind: 'rect', x: cx, y: yTop, w, h: yBot - yTop, rx: w / 2, paint: ref(`cg${b}`), opacity: op },
  ];
  if (t < 0.78) {
    const nOp = (1 - t) * 0.55;
    const nodeColor = mix(C.nodeBase, C.culmMist, t * 0.8);
    for (let y = yTop + 52; y < yBot - 16; y += 74 - 20 * t) {
      prims.push({
        kind: 'rect', x: cx, y, w, h: Math.max(1.6, 2.6 - 1.4 * t),
        paint: solid(nodeColor), opacity: nOp,
      });
      // 節のリング(t<0.5 のみ)。北星品質の立体感
      if (t < 0.5) {
        prims.push({
          kind: 'ellipse', cx: cx + w / 2, cy: y + 1.3, rx: w / 2 + 2, ry: 3,
          stroke: { color: nodeColor, width: 1.3, opacity: nOp * 0.8 },
        });
      }
    }
    // 右側の明帯(ハイライト)
    prims.push({
      kind: 'rect', x: cx + w * 0.62, y: yTop, w: w * 0.26, h: yBot - yTop, rx: w * 0.13,
      paint: solid(C.culmHighlight), opacity: (1 - t) * 0.36,
    });
    // 最前列だけ左の陰
    if (t < 0.4) {
      prims.push({
        kind: 'rect', x: cx, y: yTop, w: w * 0.2, h: yBot - yTop, rx: w * 0.1,
        paint: solid(C.culmEdge), opacity: (1 - t) * 0.3,
      });
    }
  }
  return prims;
}

// ---------------------------------------------------------------- 分布(mock v4 移植)

// 中央パネル(構図100%): 浅深度(t<0.45)約10本、中間(0.55〜0.85)約10本、最奥(>0.85)約8本。
// 参道の消失点(構図中央の帯 x≈1590-1720)には稈を置かない。mock v4 centerCulms をそのまま。
const CENTER_CULMS: [number, number][] = [
  [960, 0.06], [1085, 0.30], [1195, 0.14], [1330, 0.42], [1445, 0.22],
  [1540, 0.36], [1760, 0.10], [1870, 0.33], [1990, 0.18], [2110, 0.44],
  [2230, 0.08], [2340, 0.28],
  [1010, 0.62], [1150, 0.72], [1290, 0.58], [1420, 0.68], [1505, 0.80],
  [1745, 0.64], [1830, 0.76], [1950, 0.60], [2060, 0.72], [2180, 0.66], [2300, 0.82],
  [1050, 0.92], [1250, 0.88], [1380, 0.95], [1620, 0.90], [1700, 0.86], [1910, 0.93], [2150, 0.90], [2270, 0.96],
];

/** 翼(左右の拡張)の稈を同じ分布ルールで生成(mock v4 seed 51)。世界座標 */
function wingCulms(): [number, number][] {
  const r = mulberry32(51);
  const out: [number, number][] = [];
  for (let i = 0; i < 11; i++) out.push([40 + r() * 800, 0.06 + r() * 0.5]);
  for (let i = 0; i < 9; i++) out.push([60 + r() * 780, 0.55 + r() * 0.42]);
  for (let i = 0; i < 11; i++) out.push([2440 + r() * 820, 0.06 + r() * 0.5]);
  for (let i = 0; i < 9; i++) out.push([2460 + r() * 800, 0.55 + r() * 0.42]);
  return out;
}

// ---------------------------------------------------------------- 梢・舞い葉(mock v4 canopyBlobs)

// [cx, cy, rx, ry, color, opacity]
const CANOPY: [number, number, number, number, string, number][] = [
  [190, 46, 300, 92, C.canopyMid, 0.6], [640, 20, 360, 108, C.canopyDark, 0.72],
  [1110, 52, 330, 98, C.canopyLight, 0.58], [1560, 14, 370, 114, C.canopyDark, 0.72],
  [2020, 50, 320, 96, C.canopyLight, 0.58], [2470, 18, 350, 106, C.canopyMid, 0.6],
  [2930, 48, 320, 95, C.canopyLight, 0.58], [3260, 20, 300, 100, C.canopyDark, 0.72],
  [420, 112, 200, 58, C.canopyUnder, 0.42], [900, 128, 220, 64, C.canopyUnder, 0.42],
  [1360, 120, 210, 60, C.canopyUnderLight, 0.42], [1830, 132, 215, 62, C.canopyUnder, 0.42],
  [2290, 120, 205, 58, C.canopyUnderLight, 0.42], [2740, 128, 210, 60, C.canopyUnder, 0.42],
  [3160, 118, 195, 58, C.canopyUnderLight, 0.42],
];
// 梢のぼかし縁
const CANOPY_HAZE: [number, number][] = [
  [440, 168], [940, 184], [1430, 172], [1920, 186], [2400, 172], [2880, 182], [3220, 170],
];

function leafPrim(x: number, y: number, rot: number, sc: number, op: number, col: string): Prim {
  return { kind: 'ellipse', cx: x, cy: y, rx: 14 * sc, ry: 4.4 * sc, rotateDeg: rot, paint: solid(col), opacity: op };
}

// ---------------------------------------------------------------- 庭に立つ竹(§変更6)

/**
 * 庭の地面に接地して立つ竹(竹林と庭を地続きに見せる)。竹林の稈と違い根元が地平線より下。
 * 接地の影(根元の楕円)と、地面を斜めに走る長い落ち影(光源=右上)を個別に持つ。
 * baseY = 接地 y(世界座標)。mock v4 gardenCulm 移植。
 */
export function gardenCulmPrims(cx: number, t: number, baseY: number): Prim[] {
  const w = 26 - (26 - 4.5) * t;
  const yTop = -30 + 120 * t;
  const b = bucketOf(t);
  const op = 1 - 0.62 * Math.pow(t, 1.15);
  const groundBot = Math.min(WORLD_H, baseY + 210);
  const prims: Prim[] = [
    // 地面を斜めに走る長い落ち影(右上光源→左下)
    {
      kind: 'polygon',
      points: [cx, baseY, cx + w, baseY, cx + w - 150, groundBot, cx - 185, groundBot],
      paint: solid(C.trunkShadow), opacity: 0.05,
    },
    // 接地の影
    {
      kind: 'ellipse', cx: cx + w / 2, cy: baseY + 3, rx: w * 1.7, ry: 6,
      paint: solid('#4A4436'), opacity: 0.25, blur: 2.6,
    },
    // 稈本体
    { kind: 'rect', x: cx, y: yTop, w, h: baseY - yTop, rx: w / 2, paint: ref(`cg${b}`), opacity: op },
  ];
  const nOp = (1 - t) * 0.55;
  const nodeColor = mix(C.nodeBase, C.culmMist, t * 0.8);
  for (let y = yTop + 52; y < baseY - 16; y += 74 - 20 * t) {
    prims.push({ kind: 'rect', x: cx, y, w, h: Math.max(1.6, 2.6 - 1.4 * t), paint: solid(nodeColor), opacity: nOp });
    if (t < 0.5) {
      prims.push({
        kind: 'ellipse', cx: cx + w / 2, cy: y + 1.3, rx: w / 2 + 2, ry: 3,
        stroke: { color: nodeColor, width: 1.3, opacity: nOp * 0.8 },
      });
    }
  }
  prims.push({
    kind: 'rect', x: cx + w * 0.62, y: yTop, w: w * 0.26, h: baseY - yTop, rx: w * 0.13,
    paint: solid(C.culmHighlight), opacity: (1 - t) * 0.36,
  });
  if (t < 0.4) {
    prims.push({
      kind: 'rect', x: cx, y: yTop, w: w * 0.2, h: baseY - yTop, rx: w * 0.1,
      paint: solid(C.culmEdge), opacity: (1 - t) * 0.3,
    });
  }
  return prims;
}

// ---------------------------------------------------------------- レイヤー構築

/**
 * 借景の竹林(連続深度の稈すべて + 梢 + 舞い葉)を1つの背景レイヤーで返す。
 * 成長パラメータを取らない = 常に同じ竹林。稈は奥(t大)から手前(t小)へ描く。
 */
export function buildBambooLayer(): SceneLayer {
  const rC = mulberry32(31);
  const all = [...CENTER_CULMS, ...wingCulms()].map(([cx, t]) => ({ t, prims: culmPrims(cx, t, rC) }));
  all.sort((a, b) => b.t - a.t); // 奥から描く
  const culmPrimsFlat: Prim[] = [];
  for (const c of all) culmPrimsFlat.push(...c.prims);

  const canopyPrims: Prim[] = CANOPY.map(([cx, cy, rx, ry, color, op]) => ({
    kind: 'ellipse', cx, cy, rx, ry, paint: solid(color), opacity: op,
  }));
  const hazePrims: Prim[] = CANOPY_HAZE.map(([cx, cy]) => ({
    kind: 'ellipse', cx, cy, rx: 105, ry: 28, paint: solid(C.canopyHaze), opacity: 0.5, blur: 2.6,
  }));
  const rL = mulberry32(7);
  const leafPrims: Prim[] = [];
  for (let i = 0; i < 16; i++) {
    leafPrims.push(leafPrim(
      60 + rL() * (WORLD_W - 120), 220 + rL() * 200, rL() * 360, 0.85 + rL() * 0.5,
      0.4 + rL() * 0.3, rL() > 0.5 ? C.leafA : C.leafB,
    ));
  }

  return {
    id: 'bamboo', parallax: 0.3,
    groups: [
      { prims: culmPrimsFlat },
      { wobble: 'strong', prims: canopyPrims },
      { prims: hazePrims },
      { prims: leafPrims },
    ],
  };
}
