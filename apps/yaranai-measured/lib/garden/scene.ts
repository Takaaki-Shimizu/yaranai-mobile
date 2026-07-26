// 庭のシーン生成: 成長パラメータ → 絵巻一枚ぶんの描画スペック。
//
// 座標系は mock v4(yaranai-crop-mock-v4): 絵巻 3300×1000、地平線 480、中央パネル(構図
// 100%)= 世界座標 [900,2400]、左右の翼は各 900。中央パネルの比率は 1500:1000 = 3:2。
//
// 描画品質の正は引き続き north-star v3(Day84)。敷石・苔房・石・目地・結界は north-star の
// 作図資産(1200×800、地平線 415)をそのまま持ち、相似変換 wx()/wy() で新世界へ置く(§0)。
// 大気(靄・空・地面・光・粒)と竹の深度分布・色は mock v4 のパラメータを移植(§変更3・4)。
//
// レイヤー構造(奥→手前)とパン追従係数は §3.1 / §5.2 に従う。

import { mulberry32, range, type Rng } from './prng';
import { GARDEN_COLORS as C, GRAIN } from './tokens';
import {
  WORLD_W, WORLD_H, FRAME_X, FRAME_W, FRAME_CX, HORIZON_Y,
  NS_SCALE_X, NS_SCALE_Y, NS_TX, NS_TY, wx, wy,
} from './dims';
import { buildBambooLayer, culmBucketPaints, gardenCulmPrims } from './bamboo';
import { FULL_WEEKS, type GrowthParams } from './growth';
import type { Paint, Prim, Scene, SceneGroup, SceneLayer, Transform } from './scene-types';

// ---------------------------------------------------------------- 基本寸法(dims.ts から再輸出)

export { WORLD_W, WORLD_H, FRAME_X, FRAME_W, HORIZON_Y } from './dims';

/** ホームの窓の中心 = 中央パネルの中心(§変更1: 構図の中央基準で 90% クロップ) */
export const HOME_CX = FRAME_CX;
/** ホーム窓のクロップ比率(構図の横 90%・縦 100%。§変更1) */
export const HOME_CROP = 0.9;
/** ホーム窓の縦横比(横 90% × 縦 100% = 1350:1000 = 1.35:1。§変更1) */
export const HOME_ASPECT = (FRAME_W * HOME_CROP) / WORLD_H;

/** 庭モードで1画面に見せる論理幅。§変更2「縦のスケールはホームと同一」に合わせ、
 *  ホームの窓と同じ 90% 幅(1350)にする。絵巻は 3300 / 1350 ≒ 2.44 画面。 */
export const VIEW_LOGICAL_W = Math.round(FRAME_W * HOME_CROP);
/** パンの中央値 = 構図中央をビュー中心に置く位置(開扉時の中央始まり)。ホームと同じ絵 */
export const PAN_CENTER = FRAME_CX - VIEW_LOGICAL_W / 2;
export const PAN_MAX = WORLD_W - VIEW_LOGICAL_W;
/** エッジピーク(§変更2 は中央始まり。ヒント用に僅かに残すが既定は 0=中央) */
export const EDGE_PEEK = 0;

const WING_SEED = 0x59a7;

// north-star 資産のサイズ拡大係数(1200→1500 / 800→1000)
const SX = NS_SCALE_X;
const SY = NS_SCALE_Y;

// ---------------------------------------------------------------- 補間ヘルパ

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function ramp(x: number, anchors: [number, number][]): number {
  if (x <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) {
    if (x <= anchors[i][0]) {
      const [x0, v0] = anchors[i - 1];
      const [x1, v1] = anchors[i];
      return lerp(v0, v1, (x - x0) / (x1 - x0));
    }
  }
  return anchors[anchors.length - 1][1];
}

function hexLerp(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(lerp((pa >> sh) & 0xff, (pb >> sh) & 0xff, t));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** RGB を一律 k 倍(0〜255 でクランプ)。敷石の明度ジッターに使う */
function shade(hex: string, k: number): string {
  const p = parseInt(hex.slice(1), 16);
  const ch = (sh: number) => Math.min(255, Math.max(0, Math.round((((p >> sh) & 0xff) * k))));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** 土→Day42→Day84 の3アンカー色補間(m: 苔の充実 0〜1) */
const lerp3 = (dry: string, mid: string, full: string, m: number) =>
  m <= 0.5 ? hexLerp(dry, mid, m / 0.5) : hexLerp(mid, full, (m - 0.5) / 0.5);

// ---------------------------------------------------------------- 配置ヘルパ(north-star → 世界)

const ref = (name: string): Paint => ({ type: 'ref', name });
const solid = (color: string): Paint => ({ type: 'solid', color });

/** north-star 座標のパスを新世界へ置く相似変換。dx,dy は north-star 空間での事前移動 */
function nsPath(dx = 0, dy = 0): Transform {
  return { tx: NS_TX + SX * dx, ty: NS_TY + SY * dy, sx: SX, sy: SY };
}
/** north-star 座標の楕円 → 世界(位置は wx/wy、サイズは SX/SY) */
function nsEllipse(
  cx: number, cy: number, rx: number, ry: number, paint: Paint,
  extra: Partial<Prim> = {},
): Prim {
  return { kind: 'ellipse', cx: wx(cx), cy: wy(cy), rx: rx * SX, ry: ry * SY, paint, ...extra } as Prim;
}
function tuftPrim(x: number, y: number, s: number, rot?: number, simple?: boolean): Prim {
  return { kind: 'tuft', x: wx(x), y: wy(y), scale: s * SX, rotateDeg: rot, simple };
}
/** 翼(世界 x・north-star 800系 y)の楕円 → 世界(x はそのまま、y だけ wy、ry を SY 倍) */
function wingEllipse(cx: number, cy: number, rx: number, ry: number, paint: Paint, extra: Partial<Prim> = {}): Prim {
  return { kind: 'ellipse', cx, cy: wy(cy), rx, ry: ry * SY, paint, ...extra } as Prim;
}

// ---------------------------------------------------------------- ペイント

// 庭の光は右上から差す(LIGHT_SHAFTS / TRUNK_SHADOWS と同じ)。石はこの一本の光に従い、
// ハイライトと天端は右上、接地影と照り返しは左下に置く。面の向きが揃っていないと
// どれだけ階調を作っても立体には見えない
const LIT_CENTER: [number, number] = [0.68, 0.24];

const radial = (colors: readonly string[], moss = false, center?: [number, number]): Paint => ({
  type: 'radial',
  center: center ?? (moss ? [0.35, 0.28] : [0.32, 0.25]),
  radius: moss ? 1 : 1.1,
  stops: [
    { offset: 0, color: colors[0] },
    { offset: moss ? 0.55 : 0.5, color: colors[1] },
    { offset: 1, color: colors[2] },
  ],
});

function buildPaints(g: GrowthParams): Record<string, Paint> {
  const m = g.moss;
  return {
    // 空: 暖色3ストップ(mock v4 skyG)。借景の空気として固定
    sky: {
      type: 'linear', from: [0, 0], to: [0, 1],
      stops: [
        { offset: 0, color: C.skyTop },
        { offset: 0.62, color: C.skyMid },
        { offset: 1, color: C.skyBottom },
      ],
    },
    // 朝靄: 暖色(mock v4 mistG)。上端 0 → 帯 .34 → 地平近く .10。固定。
    // 全面に均一なベールが掛かると曇天に見えるため、靄は「奥だけ霞む」濃さに留めて
    // 空気を澄ませる(厳か調整。mock v4 の .52 から引き下げ)
    mist: {
      type: 'linear', from: [0, 0], to: [0, 1],
      stops: [
        { offset: 0, color: C.mist, opacity: 0 },
        { offset: 0.72, color: C.mist, opacity: 0.34 },
        { offset: 1, color: C.mist, opacity: 0.1 },
      ],
    },
    // 地面: 苔の充実 m で 土色→中間の緑→完成の緑 へ補間(§変更3)。
    // 初期〜中期は暖色の土で画面を暗くせず、Day84 では苔が地面全体を覆う(north-star)
    field: {
      type: 'linear', from: [0, 0], to: [0, 1],
      stops: [
        { offset: 0, color: lerp3(C.ground[0], C.fieldMid[0], C.fieldFull[0], m) },
        { offset: 0.45, color: lerp3(C.ground[1], C.fieldMid[1], C.fieldFull[1], m) },
        { offset: 1, color: lerp3(C.ground[2], C.fieldMid[2], C.fieldFull[2], m) },
      ],
    },
    joint: {
      type: 'linear', from: [0, 0], to: [0, 1],
      stops: [
        { offset: 0, color: C.jointTop },
        { offset: 1, color: C.jointBottom },
      ],
    },
    // 石の側面。光源(右上)に合わせて明部を右上へ寄せる
    stone: radial([C.stoneLight, C.sumi, C.stoneDark], false, LIT_CENTER),
    // 縁の光。光源から遠い左へ向かって消す。全周が同じ明るさだと白フチの縁取りに見える
    rimLight: {
      type: 'linear', from: [1, 0.05], to: [0.1, 0.85],
      stops: [
        { offset: 0, color: C.stoneRim, opacity: 1 },
        { offset: 0.5, color: C.stoneRim, opacity: 0.5 },
        { offset: 1, color: C.stoneRim, opacity: 0 },
      ],
    },
    // 石の天端。右上から左下へ落ちる面。側面との境=稜線が立体の芯になる
    stoneTop: {
      type: 'linear', from: [0.85, 0], to: [0.15, 1],
      stops: [
        { offset: 0, color: C.stoneTopLight },
        { offset: 1, color: C.stoneTopDark },
      ],
    },
    // 蹲踞の水(§変更2 右翼。mock v4 waterG)
    water: {
      type: 'radial', center: [0.5, 0.4], radius: 0.8,
      stops: [{ offset: 0, color: C.water[0] }, { offset: 1, color: C.water[1] }],
    },
    // 敷石は一枚ごとに色を持つ(COBBLE_PAINTS)。3階調のパレット直参照はしない
    ...COBBLE_PAINTS,
    mossLight: radial(C.mossLight, true),
    mossMid: radial(C.mossMid, true),
    mossDeep: radial(C.mossDeep, true),
    // 竹の深度バケツ(§変更4)
    ...culmBucketPaints(),
    // ビネットは de-gloom のためごく淡く(mock v4 はビネット無し)
    vignette: {
      type: 'radial', center: [0.5, 0.46], radius: 0.82,
      stops: [
        { offset: 0.66, color: C.shadowInk, opacity: 0 },
        { offset: 1, color: C.shadowInk, opacity: 0.045 },
      ],
    },
  };
}

// ---------------------------------------------------------------- north-star 作図資産(1200×800)

// 参道の目地(S字)。north-star v3 準拠。構図中央にS字で霞の奥へ(§変更5)
const JOINT_D =
  'M525,805 C517,790 513,775 512,760 C509,747 507,733 506,720 C504,708 503,697 503,685 ' +
  'C503,673 504,661 506,650 C510,638 515,626 521,615 C526,604 531,593 537,583 C545,573 553,563 561,553 ' +
  'C568,544 576,534 582,525 C584,516 585,507 585,498 C584,490 582,481 581,473 C580,465 579,458 579,450 ' +
  'C578,443 576,436 575,430 L602,430 C607,436 610,443 613,450 C617,458 620,465 623,473 C627,481 631,490 635,498 ' +
  'C637,507 640,516 642,525 C639,534 635,544 631,553 C627,563 623,573 619,583 C616,593 613,604 611,615 ' +
  'C608,626 607,638 606,650 C606,661 608,673 613,685 C617,697 621,708 626,720 C632,733 639,747 647,760 ' +
  'C656,775 665,790 675,805 Z';

type CobbleSpec = [cx: number, cy: number, rx: number, ry: number, rot: number, paint: 'A' | 'B' | 'C'];
const COBBLES: CobbleSpec[] = [
  [545, 795, 24, 14, 8, 'A'], [600, 793, 26, 15, -5, 'B'], [655, 796, 23, 13, 11, 'C'],
  [528, 763, 22, 13, -9, 'C'], [583, 761, 24, 14, 6, 'A'], [636, 764, 21, 12, -7, 'B'],
  [520, 726, 20, 12, 10, 'B'], [570, 724, 22, 13, -4, 'C'], [618, 727, 19, 11, 7, 'A'],
  [512, 692, 18, 11, -11, 'A'], [558, 690, 20, 12, 5, 'B'], [604, 693, 17, 10, -6, 'C'],
  [516, 657, 17, 10, 9, 'C'], [558, 655, 18, 11, -8, 'A'], [598, 658, 16, 9, 4, 'B'],
  [528, 622, 15, 9, -5, 'B'], [566, 620, 17, 10, 8, 'C'], [604, 623, 14, 8, -10, 'A'],
  [545, 589, 14, 8, 6, 'A'], [580, 587, 15, 9, -7, 'B'], [613, 590, 13, 7.5, 9, 'C'],
  [566, 557, 13, 7.5, -6, 'C'], [598, 555, 14, 8, 5, 'A'], [626, 558, 12, 7, -9, 'B'],
  [588, 528, 12, 7, 7, 'B'], [616, 526, 13, 7.5, -5, 'C'], [638, 529, 11, 6, 8, 'A'],
  [592, 500, 11, 6, -8, 'A'], [618, 498, 12, 6.5, 6, 'B'],
  [588, 476, 10, 5.5, -6, 'C'], [612, 474, 10.5, 6, 9, 'A'],
  [585, 455, 9, 5, -7, 'B'], [606, 453, 9, 5, 5, 'C'],
  [582, 436, 7.5, 4, 6, 'A'], [598, 435, 8, 4.5, -6, 'B'],
];

// 敷石の個体差。3階調のパレットをそのまま使うと35枚が同じ石に見え、参道が
// 一枚の面に潰れる。写真の敷石は「白っぽい石・赤茶の石・黒い石が隣り合っている」こと
// そのものが本物の signal なので、一枚ごとに明度と色味を決定論的に振る。
// ハイライトの位置も少し振る(石の傾きの差)が、光は上から、の原則は崩さない
// (光源方向そのものを右上へ揃えるのは敷石プリミティブ化の回で扱う)。
const COBBLE_JITTER_SEED = 0x0c0b1e;
const COBBLE_SHAPE_SEED = 0x51a7c3;
const cobblePaintName = (i: number) => `cobble${i}`;

/** 石ごとの色。fill=側面、top=天端、rim=右上の縁に乗る陽 */
type CobbleStyle = { fill: Paint; top: string; rim: string };

const COBBLE_STYLES: CobbleStyle[] = (() => {
  const rng = mulberry32(COBBLE_JITTER_SEED);
  return COBBLES.map(([, , , , , pt]) => {
    const base = pt === 'A' ? C.cobbleA : pt === 'B' ? C.cobbleB : C.cobbleC;
    const k = range(rng, 0.78, 1.22); // 明度: 最明の石と最暗の石で 1.5 倍以上開く
    const t = range(rng, -0.2, 0.2); // 色味: + が暖(赤茶)、- が寒(青灰)
    const tint = t >= 0 ? C.cobbleTintWarm : C.cobbleTintCool;
    const colors = base.map((c) => hexLerp(shade(c, k), tint, Math.abs(t)));
    return {
      fill: {
        type: 'radial',
        // 明部は光源側(右上)へ。石ごとの傾きの差として少しだけ振る
        center: [range(rng, 0.58, 0.76), range(rng, 0.18, 0.32)],
        radius: 1.1,
        stops: [
          { offset: 0, color: colors[0] },
          { offset: 0.5, color: colors[1] },
          { offset: 1, color: colors[2] },
        ],
      },
      top: hexLerp(colors[0], C.cobbleTopLight, 0.45),
      rim: hexLerp(colors[0], C.cobbleRimSun, 0.55),
    };
  });
})();

const COBBLE_PAINTS: Record<string, Paint> = (() => {
  const out: Record<string, Paint> = {};
  COBBLE_STYLES.forEach((s, i) => { out[cobblePaintName(i)] = s.fill; });
  return out;
})();

// 石ごとの不定形(単位円上の点列)。楕円のままだと玉が整列して見えるので、割石らしい
// 多角形にする。頂点数と半径を決定論的に振り、group の揺らぎ(cobble)が縁をさらに崩す
const COBBLE_SHAPES: [number, number][][] = (() => {
  const rng = mulberry32(COBBLE_SHAPE_SEED);
  return COBBLES.map(() => {
    // 頂点が少ないと結晶のような多角形タイルになる。9〜12頂点で「角の取れた不定形」に
    const n = 9 + Math.floor(rng() * 4);
    const out: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = ((i + range(rng, -0.16, 0.16)) / n) * Math.PI * 2;
      const k = range(rng, 0.8, 1.06);
      out.push([Math.cos(a) * k, Math.sin(a) * k]);
    }
    return out;
  });
})();

/** 敷石の多角形 → 世界座標の点列。s=拡大率、dx/dy=north-star 空間でのずらし */
function cobblePoly(i: number, spec: CobbleSpec, s: number, dx: number, dy: number): number[] {
  const [cx, cy, rx, ry, rot] = spec;
  const c = Math.cos((rot * Math.PI) / 180);
  const sn = Math.sin((rot * Math.PI) / 180);
  const pts: number[] = [];
  for (const [ux, uy] of COBBLE_SHAPES[i]) {
    const px = ux * rx * s;
    const py = uy * ry * s;
    pts.push(wx(cx + dx + px * c - py * sn), wy(cy + dy + px * sn + py * c));
  }
  return pts;
}

/** 記録日数 → 敷石の枚数。Day1=3 / Day42=24 / Day84=全35。単調非減少 */
export function cobbleCount(recordedDays: number): number {
  const n = Math.max(0, Math.floor(recordedDays));
  if (n === 0) return 0;
  if (n <= 42) return Math.min(24, 3 + Math.round(((n - 1) * 21) / 41));
  return Math.min(COBBLES.length, 24 + Math.round(((n - 42) * (COBBLES.length - 24)) / 42));
}

// 杭(左右の列、手前→奥)と縄のセグメント
const POSTS_L: [number, number, number, number, number][] = [
  [509, 732, 5, 28, 1.5], [502, 666, 4.5, 24, 1.5], [528, 591, 4, 21, 1.2],
  [570, 522, 3.5, 18, 1], [572, 465, 3, 15, 1], [572, 420, 3, 12, 1],
];
const POSTS_R: [number, number, number, number, number][] = [
  [645, 732, 5, 28, 1.5], [609, 666, 4.5, 24, 1.5], [600, 591, 4, 21, 1.2],
  [638, 522, 3.5, 18, 1], [613, 465, 3, 15, 1], [594, 420, 3, 12, 1],
];
const ROPE_L_START = 'M512,732';
const ROPE_L_SEGS = ['Q503,702 505,666', 'Q512,626 530,591', 'Q550,554 572,522', 'Q576,492 574,465', 'Q572,440 574,420'];
const ROPE_R_START = 'M648,732';
const ROPE_R_SEGS = ['Q622,700 611,666', 'Q604,636 602,591', 'Q616,560 640,522', 'Q626,492 615,465', 'Q604,440 596,420'];

/** 記録日数 → 杭の対の数。Day1=1 / Day42=3 / Day84=6。縄は対-1 セグメント */
export function postPairCount(recordedDays: number): number {
  return Math.max(1, Math.round(6 * clamp01(recordedDays / 84)));
}

// 石(§4: 宣言。Day 1 から完成状態)
const STONE_MAIN_D =
  'M292,532 q22,-50 76,-56 q62,-6 94,28 q26,32 -6,56 q-44,34 -102,22 q-56,-12 -62,-50 z';
const STONE_MAIN_SKIRT_D =
  'M306,558 q40,26 118,16 q26,-4 38,-16 q-10,26 -50,34 q-70,12 -106,-14 z';
const STONE_COMP_D =
  'M822,598 q14,-34 52,-38 q42,-4 62,20 q16,22 -6,38 q-30,22 -68,14 q-38,-8 -40,-34 z';
const STONE_COMP_SKIRT_D =
  'M830,618 q26,14 68,8 q16,-2 24,-10 q-6,16 -32,22 q-42,8 -64,-10 z';
// 天端の面(シルエットの上縁 → 稜線で左下へ戻る)。ここが側面と分かれることで塊が岩になる
// 天端は上縁に沿ったレンズ状に絞り、光源から遠い左では閉じること。上半分を丸ごと
// 明るくすると稜線が石の一番太い所を横切り、二色に塗り分けた卵に見える。
// 稜線(戻りの辺)は折れていること。滑らかな一本の弧だと丘の稜線になって岩にならない
const STONE_MAIN_TOP_D =
  'M330,500 q12,-22 38,-24 q60,-6 94,28 q-14,14 -34,17 q-16,2 -32,-4 q-20,-7 -40,-6 q-20,1 -26,-11 z';
const STONE_COMP_TOP_D =
  'M846,578 q8,-16 28,-18 q40,-4 62,20 q-9,9 -22,11 q-11,1 -21,-3 q-13,-5 -26,-3 q-13,2 -21,-7 z';
// 右上の縁の光は「本体と同じ形を光の側へずらして下に敷き、はみ出た分だけを見せる」で作る。
// 別のパスで縁をなぞると太さが均一な帯になって、貼り付けたように見える

// 苔の房。[x, y, finalScale, rot, day42Scale?]
type TuftSpec = { x: number; y: number; s: number; rot?: number; s42?: number };
const FAR_TUFTS: TuftSpec[] = [
  { x: 150, y: 448, s: 0.55, s42: 0.45 }, { x: 300, y: 458, s: 0.6, s42: 0.5 },
  { x: 432, y: 448, s: 0.5 }, { x: 706, y: 452, s: 0.6, s42: 0.5 },
  { x: 836, y: 444, s: 0.5 }, { x: 982, y: 454, s: 0.6, s42: 0.45 },
  { x: 1112, y: 446, s: 0.55 }, { x: 60, y: 456, s: 0.5 },
];
const MID_TUFTS: TuftSpec[] = [
  { x: 140, y: 502, s: 1.05, s42: 0.9 }, { x: 262, y: 542, s: 1.2, s42: 1.05 },
  { x: 396, y: 486, s: 0.95, s42: 0.85 }, { x: 460, y: 548, s: 1.15, rot: 6, s42: 1 },
  { x: 726, y: 540, s: 1.2, rot: -5, s42: 1 }, { x: 796, y: 492, s: 1 },
  { x: 948, y: 522, s: 1.2, s42: 0.9 }, { x: 1084, y: 498, s: 1.05, rot: 4 },
  { x: 58, y: 562, s: 1.15, s42: 0.95 }, { x: 1156, y: 562, s: 1.1 },
  { x: 196, y: 472, s: 0.8 }, { x: 872, y: 470, s: 0.8, rot: -8 },
];
const FORE_TUFTS: TuftSpec[] = [
  { x: 112, y: 646, s: 2, s42: 1.6 }, { x: 94, y: 742, s: 1.8, rot: 5, s42: 1.4 },
  { x: 252, y: 708, s: 2.2, s42: 1.7 }, { x: 336, y: 642, s: 1.5, rot: -6, s42: 1.2 },
  { x: 408, y: 748, s: 1.8 }, { x: 462, y: 672, s: 1.3, rot: 8, s42: 1 },
  { x: 752, y: 678, s: 1.5, rot: -4 }, { x: 816, y: 748, s: 2, s42: 1.5 },
  { x: 936, y: 656, s: 1.7, s42: 1.2 }, { x: 1046, y: 722, s: 2.2, rot: 6 },
  { x: 1148, y: 646, s: 1.6, rot: -7 }, { x: 1160, y: 762, s: 1.9 },
  { x: 202, y: 606, s: 1.2, s42: 1 }, { x: 980, y: 592, s: 1.15, rot: -5 },
  { x: 452, y: 606, s: 1, rot: 4 }, { x: 736, y: 606, s: 1.05 },
];
// 前景の苔の面。[cx, cy, rx, ry, deep?, day42比率]
const FORE_BLOBS: [number, number, number, number, boolean, number | null][] = [
  [150, 740, 150, 70, true, 0.86], [390, 775, 130, 60, false, null],
  [810, 778, 140, 62, true, 0.79], [1080, 745, 160, 72, false, null],
];

// 木漏れ日: 光だまり [cx, cy, rx, ry, rot, 最終op(Day84)]。暖色(§変更3)。
// op は厳か調整で mock の約1.6倍。光だまりと竹の落ち影のペアが「差し込む光」を作り、
// 明暗の対比を(全体の明度ではなく)光の側に担わせる
const LIGHT_POOLS: [number, number, number, number, number, number][] = [
  [230, 450, 160, 20, -14, 0.34],
  [650, 452, 180, 22, -12, 0.32],
  [1010, 448, 160, 20, -14, 0.34],
  [150, 520, 120, 30, -18, 0.4],
  [1010, 540, 130, 32, -15, 0.4],
  [300, 600, 190, 46, -16, 0.46],
  [860, 640, 210, 50, -14, 0.42],
  [560, 700, 160, 40, -12, 0.36],
];
// 竹の長い影(右上光源→左下)。[点8つ, 最終op]
const TRUNK_SHADOWS: [number[], number][] = [
  [[159, 446, 176, 446, 20, 586, -12, 574], 0.24],
  [[260, 442, 274, 442, 108, 578, 78, 568], 0.22],
  [[470, 440, 482, 440, 318, 572, 290, 562], 0.22],
  [[640, 442, 653, 442, 476, 584, 446, 573], 0.24],
  [[860, 442, 874, 442, 692, 592, 660, 580], 0.22],
  [[1030, 442, 1043, 442, 862, 588, 832, 577], 0.22],
  [[1122, 452, 1148, 452, 964, 640, 924, 624], 0.24],
  [[1008, 448, 1026, 448, 850, 616, 818, 603], 0.2],
];
const BRANCH_SHADOWS: [number[], number][] = [
  [[668, 700, 690, 688, 508, 760, 496, 776], 0.13],
  [[648, 586, 664, 577, 522, 642, 512, 655], 0.12],
];
// 光条(右上の光源から斜めに)。[点8つ, 最終op]
const LIGHT_SHAFTS: [number[], number][] = [
  [[760, 30, 830, 30, 520, 560, 455, 535], 0.24],
  [[950, 60, 1005, 60, 700, 540, 650, 520], 0.18],
  [[560, 20, 610, 20, 430, 430, 390, 415], 0.14],
];

// ---------------------------------------------------------------- 光の到達距離(§変更2、north-star 800系)

const LIGHT_FEET_Y = 452;
const LIGHT_BOTTOM_Y = 900;
const LIGHT_FEATHER = 180;
function lightReach(weeks: number): number {
  // 光は Day1 から庭に差している(床 0.4)。成長は「光が生まれる」ではなく
  // 「光の届く範囲が手前へ広がる」変化にする(厳かさは光と影の共存から生まれる)
  return 0.4 + 0.6 * clamp01(weeks / FULL_WEEKS);
}
function lightFrontY(reach: number): number {
  return lerp(LIGHT_FEET_Y, LIGHT_BOTTOM_Y, reach);
}
function lightVisAt(frontY: number, y: number): number {
  return clamp01((frontY - y) / LIGHT_FEATHER + 0.5);
}

// Day 1 の乾いた地肌テクスチャ(暖色の土に馴染む)
const DRY_PATCHES: [number, number, number, number][] = [
  [980, 475, 110, 26], [120, 700, 100, 30], [420, 765, 80, 22], [1130, 580, 70, 20],
];
const DRY_GRAINS: [number, number][] = [
  [120, 520], [240, 620], [180, 720], [420, 560], [760, 600], [900, 700],
  [1020, 560], [1100, 680], [330, 760], [700, 740], [80, 620], [960, 480],
];
const MOSS_PATCHES: [number, number, number, number][] = [
  [486, 452, 2.6, 0.35], [286, 452, 2.4, 0.35], [762, 448, 2.4, 0.35],
  [1046, 700, 2.6, 0.35], [1120, 640, 2.4, 0.35], [700, 720, 2.4, 0.35],
  [96, 452, 3, 0.7], [936, 456, 3, 0.7], [1130, 448, 2.4, 0.7],
];

// ---------------------------------------------------------------- 房の展開テーブル(レンダラ共用)

export const TUFT_BALLS: [number, number, number, number, 'mossMid' | 'mossDeep' | 'mossLight'][] = [
  [0, 0, 34, 18, 'mossMid'], [-30, 10, 26, 14, 'mossDeep'], [30, 8, 24, 13, 'mossLight'],
  [-8, 18, 20, 11, 'mossDeep'], [18, -10, 18, 10, 'mossLight'], [-38, -6, 16, 9, 'mossMid'],
  [40, 16, 14, 8, 'mossDeep'], [4, -16, 12, 7, 'mossMid'], [-20, -14, 10, 6, 'mossLight'],
];
export const TUFT_GRAINS_LIGHT: [number, number, number][] = [
  [-20, -8, 2.6], [-5, -14, 2.2], [10, -10, 2.8], [24, -2, 2.2], [-32, 4, 2.4], [2, 2, 2],
  [16, 8, 2.4], [-14, 10, 2.2], [30, 10, 2], [-26, 14, 2.4], [8, 16, 2], [38, 2, 2.2],
];
export const TUFT_GRAINS_DARK: [number, number, number][] = [
  [-12, 16, 2.2], [22, 14, 2], [-36, 12, 2.2], [36, 18, 1.8],
];
export const TUFT_SIMPLE_BALLS = TUFT_BALLS.slice(0, 5);
export const TUFT_SIMPLE_GRAINS_LIGHT: [number, number, number][] = [
  [-20, -8, 2.6], [10, -10, 2.8], [-32, 4, 2.4], [16, 8, 2.4], [-14, 10, 2.2],
];
export const TUFT_SIMPLE_GRAINS_DARK: [number, number, number][] = [
  [-12, 16, 2.2], [22, 14, 2],
];

// ---------------------------------------------------------------- 房の出現制御

const STONE_CENTER = { x: 352, y: 530 };
function tuftThresholds(tufts: TuftSpec[]): number[] {
  const dist = (t: TuftSpec) => Math.hypot(t.x - STONE_CENTER.x, t.y - STONE_CENTER.y);
  const rank = (subset: TuftSpec[], lo: number, hi: number) => {
    const sorted = [...subset].sort((a, b) => dist(a) - dist(b));
    const map = new Map<TuftSpec, number>();
    sorted.forEach((t, i) => {
      map.set(t, subset.length === 1 ? lo : lo + ((hi - lo) * i) / (subset.length - 1));
    });
    return map;
  };
  const members = tufts.filter((t) => t.s42 != null);
  const rest = tufts.filter((t) => t.s42 == null);
  const mMap = rank(members, 0.03, 0.45);
  const rMap = rank(rest, 0.52, 0.95);
  return tufts.map((t) => (t.s42 != null ? mMap.get(t)! : rMap.get(t)!));
}
function tuftScaleAt(t: TuftSpec, thr: number, m: number): number | null {
  if (m < thr) return null;
  if (t.s42 != null) {
    const s42 = t.s42 / t.s;
    if (m <= 0.5) {
      const k = thr >= 0.5 ? 1 : (m - thr) / (0.5 - thr);
      return t.s * lerp(0.6 * s42, s42, k);
    }
    return t.s * lerp(s42, 1, (m - 0.5) / 0.5);
  }
  return t.s * lerp(0.6, 1, thr >= 1 ? 1 : (m - thr) / (1 - thr));
}

// ---------------------------------------------------------------- 翼(左右の拡張。§変更2)

// 翼の苔房を中央パネル [900,2400] の外側にだけ散らす。苔は中央と同じく苔充実度 m で育つ
// (取り戻した時間の反映)。ハードスケープの motif(三尊石・蹲踞・飛び石・庭の竹)だけが
// 完成形固定(借景と同じ)。位置は決定論的、y は north-star 800系(wy() で新世界へ)。
type WT = { x: number; y: number; s: number; rot: number; thr: number };
function wingScatter(rng: Rng, xMin: number, xMax: number, count: number, band: [number, number], sRange: [number, number]): WT[] {
  const out: WT[] = [];
  for (let i = 0; i < count; i++) {
    const x = range(rng, xMin, xMax);
    // 中央パネルの縁から遠いほど遅く現れる(外周へ広がる)
    const d = Math.min(Math.abs(x - FRAME_X), Math.abs(x - (FRAME_X + FRAME_W)));
    const thr = clamp01(0.3 + 0.6 * (d / FRAME_X) + range(rng, -0.06, 0.06));
    out.push({ x, y: range(rng, band[0], band[1]), s: range(rng, sRange[0], sRange[1]), rot: range(rng, -8, 8), thr });
  }
  return out;
}
const WING = (() => {
  const rng = mulberry32(WING_SEED);
  const far = [...wingScatter(rng, 260, 880, 7, [440, 462], [0.45, 0.6]), ...wingScatter(rng, 2420, 3080, 4, [440, 462], [0.45, 0.6])];
  const mid = [...wingScatter(rng, 230, 880, 10, [478, 566], [0.85, 1.2]), ...wingScatter(rng, 2420, 3100, 5, [478, 566], [0.8, 1.1])];
  const fore = [...wingScatter(rng, 130, 880, 10, [640, 770], [1.2, 2.2]), ...wingScatter(rng, 2420, 3220, 8, [618, 774], [1.1, 1.9])];
  // 前景の苔面 [cx, cy(800系), rx, ry, deep, thr]
  const blobs: [number, number, number, number, boolean, number][] = [
    [430, 786, 150, 70, true, 0.35], [760, 800, 130, 62, false, 0.55], [120, 775, 130, 64, false, 0.75],
    [2450, 792, 140, 64, true, 0.5], [2900, 788, 150, 70, false, 0.7], [3220, 795, 130, 62, true, 0.85],
  ];
  return { far, mid, fore, blobs };
})();

/** 苔充実度 m での翼房。m<thr は現れない。単調非減少 */
function wingTuftPrim(t: WT, m: number): Prim | null {
  if (m < t.thr) return null;
  const k = lerp(0.6, 1, clamp01((m - t.thr) / Math.max(0.05, 1 - t.thr)));
  return { kind: 'tuft', x: t.x, y: wy(t.y), scale: t.s * SX * k, rotateDeg: t.rot };
}

// 翼の光: 中央パネルの光の語彙(光だまり・竹の落ち影・光条・日なた苔)を左右の翼にも
// 同じ規則で敷く。中央にだけ光が差すと、絵巻を歩いたとき翼が「別の天気の土地」に見える。
// op と到達距離のルール(lightVisAt / shaftK)は中央の LIGHT_POOLS / TRUNK_SHADOWS /
// LIGHT_SHAFTS と共有する。x は世界座標、y は north-star 800系(wy() で新世界へ)。
// ホームの窓(世界 [PAN_CENTER, PAN_CENTER+VIEW_LOGICAL_W] = [975,2325])に掛からない
// 位置にだけ置き、ホームの静止画は変えない。
// 光だまり [cx, cy, rx, ry, rot, 最終op]
const WING_LIGHT_POOLS: [number, number, number, number, number, number][] = [
  // 左翼
  [300, 452, 190, 22, -13, 0.32],
  [560, 620, 150, 38, -15, 0.42],
  [430, 726, 170, 44, -14, 0.4],
  // 右翼
  [2520, 455, 170, 21, -13, 0.32],
  [2820, 610, 180, 44, -15, 0.42],
  [3010, 690, 150, 40, -12, 0.38],
];
// 竹の長い影(右上光源→左下)。[点8つ, 最終op]
const WING_TRUNK_SHADOWS: [number[], number][] = [
  // 左翼
  [[520, 444, 538, 444, 345, 582, 311, 570], 0.22],
  [[710, 446, 728, 446, 535, 584, 501, 572], 0.24],
  [[300, 442, 316, 442, 130, 570, 100, 560], 0.2],
  // 右翼
  [[2560, 444, 2578, 444, 2385, 582, 2351, 570], 0.22],
  [[2770, 446, 2788, 446, 2595, 584, 2561, 572], 0.24],
  [[2985, 442, 3001, 442, 2815, 570, 2785, 560], 0.2],
];
// 光条(右上の光源から斜めに)。傾きは中央の光条と揃える(光源は一本)。[点8つ, 最終op]
// 光条はぼかしが大きい(blur 16 ≒ 48px 滲む)ので、窓の境界からその分だけ離す
const WING_LIGHT_SHAFTS: [number[], number][] = [
  // 左翼
  [[860, 30, 930, 30, 560, 560, 495, 535], 0.24],
  [[690, 20, 742, 20, 528, 430, 488, 415], 0.14],
  // 右翼
  [[2680, 60, 2735, 60, 2430, 540, 2383, 520], 0.18],
  [[2740, 20, 2790, 20, 2578, 430, 2538, 415], 0.14],
];
/** 翼テーブルの点列(世界x・north-star y)→ 世界座標(y だけ wy) */
const wingPts = (pts: number[]) => pts.map((v, i) => (i % 2 === 0 ? v : wy(v)));
/** 影の最も手前(下端)の y。光の到達判定はここで取る(中央と同じ) */
const wingShadowFrontY = (pts: number[]) => Math.max(...pts.filter((_, i) => i % 2 === 1));

// 石(north-star 品質。world 座標)。§変更2 の三尊石で共用。
// 中央パネルの石と同じ光(右上)に揃える: 落ち影 → 縁の光 → 本体 → 天端 → 陰 → 苔の照り返し
function worldStone(cx: number, cy: number, rx: number, ry: number, m: number): Prim[] {
  return [
    { kind: 'ellipse', cx, cy: cy + ry * 0.86, rx: rx * 1.08, ry: ry * 0.36, paint: solid('#4A4436'), opacity: 0.22, blur: 6 },
    { kind: 'ellipse', cx: cx + rx * 0.045, cy: cy - ry * 0.06, rx, ry, paint: ref('rimLight'), opacity: 0.4 },
    { kind: 'ellipse', cx, cy, rx, ry, paint: ref('stone') },
    { kind: 'ellipse', cx: cx + rx * 0.26, cy: cy - ry * 0.4, rx: rx * 0.58, ry: ry * 0.33, paint: solid(C.stoneTopLight), opacity: 0.4, blur: 5 },
    { kind: 'ellipse', cx: cx - rx * 0.32, cy: cy + ry * 0.3, rx: rx * 0.5, ry: ry * 0.34, paint: solid(C.stoneDark), opacity: 0.5, blur: 2.2 },
    { kind: 'ellipse', cx: cx - rx * 0.3, cy: cy + ry * 0.44, rx: rx * 0.46, ry: ry * 0.2, paint: solid(C.stoneBounce), opacity: 0.16 * (0.35 + 0.65 * m), blur: 6 },
  ];
}
// 飛び石(参道から分かれる。world 座標)
function steppingStone(x: number, y: number, sz: number, op: number): Prim[] {
  return [
    { kind: 'ellipse', cx: x, cy: y + 3, rx: sz * 0.56, ry: sz * 0.24, paint: solid('#6E6858'), opacity: 0.55 * op },
    { kind: 'ellipse', cx: x, cy: y, rx: sz * 0.55, ry: sz * 0.23, paint: solid('#948C77'), opacity: op },
    { kind: 'ellipse', cx: x - sz * 0.1, cy: y - sz * 0.05, rx: sz * 0.4, ry: sz * 0.14, paint: solid('#ABA28A'), opacity: 0.8 * op },
  ];
}

/**
 * 翼(左右の拡張)のレイヤー群(§変更2)。id は 'wing-' 始まりで、絵巻(GardenScroll)は
 * 開扉時にこれらだけをフェードインさせる(差分演出とは別系統、イージング/時間は共有)。
 * 苔は中央と同じく m で育つ。motif(三尊石・蹲踞・飛び石・庭の竹)は完成形固定=借景。
 * 左翼: 三尊石+苔。右翼: 参道から分かれる飛び石+蹲踞(水鉢・水面・柄杓)+苔。庭の竹 左2右3。
 * 光(光だまり・落ち影・光条・日なた苔)は中央と同じ規則で敷く(絵巻全体で一つの朝)。
 */
function buildWingLayers(m: number, frontY: number, reach: number): SceneLayer[] {
  const layers: SceneLayer[] = [];
  const tufts = (list: WT[]) => list.map((t) => wingTuftPrim(t, m)).filter((p): p is Prim => p != null);

  // wing-field (0.8): 遠中景の苔 + 光だまり(中央 field と同じく reach で手前へ滲む)
  const poolPrims: Prim[] = [];
  WING_LIGHT_POOLS.forEach(([cx, cy, rx, ry, rot, opFull]) => {
    const op = opFull * lightVisAt(frontY, cy);
    if (op <= 0.005) return;
    poolPrims.push(wingEllipse(cx, cy, rx, ry, solid(C.lightPool), { rotateDeg: rot, opacity: op }));
  });
  layers.push({
    id: 'wing-field', parallax: 0.8,
    groups: [
      { blur: 1.2, opacity: 0.85, prims: tufts(WING.far) },
      { wobble: 'soft', prims: tufts(WING.mid) },
      ...(poolPrims.length ? [{ blur: 4, prims: poolPrims } as SceneGroup] : []),
    ],
  });

  // wing-shadows (0.8): 竹の長い落ち影。中央と同じく、光が届いた所にだけ落ちる
  const shadowPrims: Prim[] = [];
  WING_TRUNK_SHADOWS.forEach(([pts, opFull]) => {
    const op = opFull * lightVisAt(frontY, wingShadowFrontY(pts));
    if (op <= 0.005) return;
    shadowPrims.push({ kind: 'polygon', points: wingPts(pts), paint: solid(C.trunkShadow), opacity: op });
  });
  if (shadowPrims.length) {
    layers.push({ id: 'wing-shadows', parallax: 0.8, groups: [{ blur: 5, prims: shadowPrims }] });
  }

  // wing-motif (1.0): 三尊石(左) / 飛び石+蹲踞(右)
  const motif: Prim[] = [];
  // 左翼: 三尊石(三尊石風の3石)
  motif.push(...worldStone(350, 700, 104, 74, m), ...worldStone(238, 782, 62, 44, m), ...worldStone(456, 768, 52, 38, m));
  // 右翼: 飛び石(参道から分かれて蹲踞へ)
  [[2470, 940, 60], [2560, 876, 52], [2644, 818, 44], [2708, 776, 38]].forEach(([x, y, sz], i) =>
    motif.push(...steppingStone(x, y, sz, 0.9 - i * 0.04)));
  // 右翼: 蹲踞(石の水鉢・水面・柄杓)
  motif.push(
    { kind: 'ellipse', cx: 2800, cy: 800, rx: 92, ry: 30, paint: solid('#4A4436'), opacity: 0.22, blur: 6 },
    { kind: 'ellipse', cx: 2800, cy: 756, rx: 86, ry: 54, paint: ref('stone') },
    { kind: 'ellipse', cx: 2800, cy: 740, rx: 52, ry: 22, paint: ref('water') },
    { kind: 'ellipse', cx: 2784, cy: 735, rx: 22, ry: 7, paint: solid(C.waterHighlight), opacity: 0.55 },
    { kind: 'rect', x: 2762, y: 706, w: 98, h: 6, rx: 3, paint: solid(C.ladle), rotate: { deg: -14, cx: 2810, cy: 709 } },
    { kind: 'circle', cx: 2854, cy: 694, r: 10, paint: solid(C.ladleKnob) },
  );
  layers.push({ id: 'wing-motif', parallax: 1.0, groups: [{ wobble: 'soft', prims: motif }] });

  // wing-fore (1.1): 前景の苔(面+房)。面も m で育つ
  const blobPrims: Prim[] = [];
  for (const [cx, cy, rx, ry, deep, thr] of WING.blobs) {
    if (m < thr) continue;
    const k = lerp(0.6, 1, clamp01((m - thr) / Math.max(0.05, 1 - thr)));
    blobPrims.push({ kind: 'ellipse', cx, cy: wy(cy), rx: rx * k, ry: ry * k * SY, paint: ref(deep ? 'mossDeep' : 'mossMid') });
  }
  layers.push({
    id: 'wing-fore', parallax: 1.1,
    groups: [
      { wobble: 'strong', prims: blobPrims },
      { wobble: 'soft', prims: tufts(WING.fore) },
    ],
  });

  // wing-moss-glow (1.1): 手前の光だまりを翼の苔の上にもう一度淡く重ねる(中央 moss-glow と同じ規則)
  const glowPrims: Prim[] = [];
  WING_LIGHT_POOLS.forEach(([cx, cy, rx, ry, rot, opFull]) => {
    if (cy < 520) return; // 苔と重なる手前の光だまりのみ
    const op = opFull * 0.55 * lightVisAt(frontY, cy);
    if (op <= 0.005) return;
    glowPrims.push(wingEllipse(cx, cy, rx * 0.92, ry * 0.92, solid(C.mossSunGlow), { rotateDeg: rot, opacity: op }));
  });
  if (glowPrims.length) {
    layers.push({ id: 'wing-moss-glow', parallax: 1.1, groups: [{ blur: 5, prims: glowPrims }] });
  }

  // wing-shafts (0.45): 右上からの光条。中央 light-shafts と同じ reach 連動。
  // 翼の竹(wing-bamboo)より先に積み、竹が光条の手前に立つ順序も中央と揃える
  const shaftK = 0.12 + 0.88 * reach;
  layers.push({
    id: 'wing-shafts', parallax: 0.45,
    groups: [{
      blur: 16,
      prims: WING_LIGHT_SHAFTS.map(([pts, opFull]) => ({
        kind: 'polygon', points: wingPts(pts), paint: solid(C.lightShaft), opacity: opFull * shaftK,
      }) as Prim),
    }],
  });

  // wing-bamboo (1.0): 庭に立つ竹 左2・右3(奥行きをばらす。§変更6 の開扉分)
  layers.push({
    id: 'wing-bamboo', parallax: 1.0,
    groups: [{
      prims: [
        ...gardenCulmPrims(640, 0.1, HORIZON_Y + 150),
        ...gardenCulmPrims(180, 0.28, HORIZON_Y + 85),
        ...gardenCulmPrims(2450, 0.32, HORIZON_Y + 80),
        ...gardenCulmPrims(2940, 0.12, HORIZON_Y + 160),
        ...gardenCulmPrims(3140, 0.22, HORIZON_Y + 110),
      ],
    }],
  });

  return layers;
}

// ---------------------------------------------------------------- 大地の輪郭(絵巻全幅、新世界)

const FIELD_D = (() => {
  const h = HORIZON_Y;
  return (
    `M0,${h - 8} C400,${h - 22} 800,${h + 4} 1200,${h - 10} ` +
    `C1600,${h - 24} 2000,${h + 2} 2400,${h - 8} ` +
    `C2700,${h - 20} 3000,${h + 2} 3300,${h - 8} ` +
    `L3300,${WORLD_H} L0,${WORLD_H} Z`
  );
})();

// ---------------------------------------------------------------- シーン構築

export function buildScene(g: GrowthParams): Scene {
  const m = g.moss;
  const w = g.weeks;
  const n = g.recordedDays;
  const reach = lightReach(w);
  const frontY = lightFrontY(reach);
  const layers: SceneLayer[] = [];
  const push = (id: string, parallax: number, groups: SceneGroup[]) => {
    const nonEmpty = groups.filter((gr) => gr.prims.length > 0 && gr.opacity !== 0);
    if (nonEmpty.length) layers.push({ id, parallax, groups: nonEmpty });
  };

  // ---- 空 (0.1)
  push('sky', 0.1, [
    { prims: [{ kind: 'rect', x: 0, y: -WORLD_H, w: WORLD_W, h: WORLD_H * 2, paint: ref('sky') }] },
  ]);

  // ---- 借景の竹林(§変更4 連続深度)。Day1 から完成形で固定。梢・葉を含む
  layers.push(buildBambooLayer());

  // ---- 朝靄 (0.6)。暖色(§変更3)。mock v4: y[110,520] を mistG で
  push('mist', 0.6, [
    { prims: [{ kind: 'rect', x: 0, y: 110, w: WORLD_W, h: HORIZON_Y - 70 + 40, paint: ref('mist'), blur: 6 }] },
  ]);

  // ---- 地面(暖色の土)+ 遠中景の房 + 光だまり (0.8)
  const fieldGroups: SceneGroup[] = [
    { wobble: 'strong', prims: [{ kind: 'path', d: FIELD_D, paint: ref('field') }] },
    // 地平線直下に落ちる靄の帯(§変更3)
    {
      prims: [{
        kind: 'rect', x: 0, y: HORIZON_Y, w: WORLD_W, h: 110,
        paint: solid(C.mistFloor), opacity: 0.35, blur: 6,
      }],
    },
  ];
  // 乾いた地肌の粒(Day1)は苔が育つと消える
  const grainOp = clamp01(1 - m / 0.5);
  if (grainOp > 0) {
    fieldGroups.push({
      opacity: grainOp,
      prims: DRY_GRAINS.map(([x, y]) => ({ kind: 'circle', cx: wx(x), cy: wy(y), r: 1.8 * SX, paint: solid(C.dryGrain) }) as Prim),
    });
  }
  const patchOp = 0.45 * clamp01(Math.min(m / 0.15, (0.95 - m) / 0.3));
  if (patchOp > 0.01) {
    fieldGroups.push({
      wobble: 'strong', opacity: patchOp,
      prims: DRY_PATCHES.map(([cx, cy, rx, ry]) => nsEllipse(cx, cy, rx, ry, solid(C.dryPatch))),
    });
  }
  // 遠景の房
  const farThr = tuftThresholds(FAR_TUFTS);
  const farPrims: Prim[] = [];
  FAR_TUFTS.forEach((t, i) => {
    const s = tuftScaleAt(t, farThr[i], m);
    if (s != null) farPrims.push(tuftPrim(t.x, t.y, s, t.rot));
  });
  fieldGroups.push({ blur: 1.2, opacity: 0.85, prims: farPrims });
  // 中景の房
  const midThr = tuftThresholds(MID_TUFTS);
  const midPrims: Prim[] = [];
  MID_TUFTS.forEach((t, i) => {
    const s = tuftScaleAt(t, midThr[i], m);
    if (s != null) midPrims.push(tuftPrim(t.x, t.y, s, t.rot));
  });
  fieldGroups.push({ wobble: 'soft', prims: midPrims });
  // 苔の飛び地
  const patchDots = MOSS_PATCHES.filter(([, , , thr]) => m >= thr).map(
    ([x, y, r]) => ({ kind: 'circle', cx: wx(x), cy: wy(y), r: r * SX, paint: solid(C.mossPatch) }) as Prim,
  );
  fieldGroups.push({ prims: patchDots });
  // 光だまり(§変更2): 奥ほど早く灯り、reach で手前へ滲む。先端は feather で柔らかく
  const poolPrims: Prim[] = [];
  LIGHT_POOLS.forEach(([cx, cy, rx, ry, rot, opFull]) => {
    const op = opFull * lightVisAt(frontY, cy);
    if (op <= 0.005) return;
    poolPrims.push(nsEllipse(cx, cy, rx, ry, solid(C.lightPool), { rotateDeg: rot, opacity: op }));
  });
  fieldGroups.push({ blur: 4, prims: poolPrims });
  push('field', 0.8, fieldGroups);

  // ---- 参道 + 石 (1.0)。構図中央にS字で(§変更5)
  const pathGroups: SceneGroup[] = [];
  const nCobbles = cobbleCount(n);
  if (nCobbles > 0) {
    const builtBackY = COBBLES[nCobbles - 1][1]; // 最奥に敷いた石の y(north-star)
    pathGroups.push({
      wobble: 'soft',
      clip: { x: 0, y: wy(builtBackY), w: WORLD_W, h: WORLD_H + 40 - wy(builtBackY) },
      prims: [{ kind: 'path', d: JOINT_D, transform: nsPath(), paint: ref('joint') }],
    });
  }
  // 敷石(記録の歩み)。接地影 → 石 の順に積む。影は石と同じ揺らぎを受ける必要が
  // あるので同一グループに入れ、かつ全部の影を先に描く(石ごとに影→石と交互に積むと、
  // 手前の石の影が一列奥の石の上に乗ってしまう)。
  // 影は光源(右上)の反対=左下へずらし、石の大きさに比例させる
  const laid = COBBLES.slice(0, nCobbles);
  const cobblePrims: Prim[] = laid.map((spec, i) => ({
    kind: 'polygon',
    points: cobblePoly(i, spec, 1.05, -spec[2] * 0.12, spec[3] * 0.34),
    paint: solid(C.cobbleShadow),
    opacity: 0.34,
    blur: Math.max(1, Math.round(spec[3] * SY * 0.18)),
  }));
  laid.forEach((spec, i) => {
    const st = COBBLE_STYLES[i];
    // 縁の光: 本体を右上へずらした同じ形を下に敷き、はみ出た分だけを陽の当たった縁にする
    cobblePrims.push({
      kind: 'polygon',
      points: cobblePoly(i, spec, 1, spec[2] * 0.05, -spec[3] * 0.1),
      paint: solid(st.rim), opacity: 0.3,
    });
    cobblePrims.push({
      kind: 'polygon', points: cobblePoly(i, spec, 1, 0, 0), paint: ref(cobblePaintName(i)),
    });
    // 天端: 光の側へ寄せて縮めた面。石の上が明るく側面が落ちることで厚みが出る
    cobblePrims.push({
      kind: 'polygon',
      points: cobblePoly(i, spec, 0.58, spec[2] * 0.16, -spec[3] * 0.2),
      paint: solid(st.top), opacity: 0.55,
      blur: Math.max(1, Math.round(spec[3] * SY * 0.14)),
    });
  });
  pathGroups.push({ wobble: 'cobble', prims: cobblePrims });
  // 杭と縄(結界。参道の両脇に沿う。§変更5)
  const pairs = postPairCount(n);
  const postPrims: Prim[] = [];
  for (const side of [POSTS_L, POSTS_R]) {
    side.slice(0, pairs).forEach(([x, y, pw, ph, rx]) => {
      postPrims.push({ kind: 'rect', x: wx(x), y: wy(y), w: pw * SX, h: ph * SY, rx: rx * SX, paint: solid(C.post) });
    });
  }
  pathGroups.push({ prims: postPrims });
  if (pairs >= 2) {
    const ropeL = ROPE_L_START + ' ' + ROPE_L_SEGS.slice(0, pairs - 1).join(' ');
    const ropeR = ROPE_R_START + ' ' + ROPE_R_SEGS.slice(0, pairs - 1).join(' ');
    pathGroups.push({
      opacity: 0.75,
      prims: [ropeL, ropeR].map((d) => ({
        kind: 'path', d, transform: nsPath(), stroke: { color: C.rope, width: 2.4 },
      }) as Prim),
    });
  }
  // 石(宣言): 主石 → 添石 → 三の石。参道を挟んで左に大石+苔、右に小石+苔(§変更5)
  const shadowOp = ramp(w, [[0, 1], [12, 1.55]]);
  const stonePrims: Prim[] = [];
  const skirtOp = clamp01((m - 0.05) / 0.25);
  // 石の根元の苔面: 宣言の日から連続した面で石の足元に敷き、m で緩やかに広がる。
  // 点在する房より先に「小さくても完成した苔の面」があることが、序盤の庭を
  // 「まだ何もない土地」ではなく「これから満ちていく整った庭」に見せる(借景と同じ思想)
  const bedK = 0.6 + 0.4 * m;
  if (g.stones >= 1) {
    stonePrims.push(
      nsEllipse(322, 606, 58 * bedK, 13 * bedK, ref('mossDeep')),
      nsEllipse(396, 612, 44 * bedK, 11 * bedK, ref('mossMid')),
    );
  }
  if (g.stones >= 2) {
    stonePrims.push(
      nsEllipse(852, 666, 46 * bedK, 10 * bedK, ref('mossMid')),
      tuftPrim(868, 670, 0.4 * (0.8 + 0.2 * m), 4, m < 0.3),
    );
  }
  if (g.stones >= 3) {
    stonePrims.push(
      nsEllipse(214, 750, 40 * bedK, 9 * bedK, ref('mossDeep')),
      tuftPrim(200, 752, 0.35 * (0.8 + 0.2 * m), -5, m < 0.3),
    );
  }
  if (g.stones >= 1) {
    stonePrims.push(
      nsEllipse(ramp(w, [[0, 372], [6, 352], [12, 348]]), ramp(w, [[0, 598], [6, 600], [12, 600]]),
        ramp(w, [[0, 92], [6, 98], [12, 102]]), ramp(w, [[0, 17], [6, 18], [12, 19]]),
        solid(C.shadowInk), { opacity: 0.14 * shadowOp, blur: 6 }),
      // 縁の光(右上)。本体を光の側へずらして下に敷く
      { kind: 'path', d: STONE_MAIN_D, transform: nsPath(2.6, -2.6), paint: ref('rimLight'),
        opacity: ramp(w, [[0, 0.34], [12, 0.46]]) },
      { kind: 'path', d: STONE_MAIN_D, transform: nsPath(), paint: ref('stone') },
      // 肌の斑。強いと汚れて見えるので、blur で溶かした薄い面として置く
      nsEllipse(326, 546, 22, 8, solid(C.stoneMottleDark), { opacity: 0.14, blur: 5 }),
      nsEllipse(372, 568, 26, 7, solid(C.stoneMottleDark), { opacity: 0.12, blur: 5 }),
      // 苔からの照り返し(左下=陰の側)。暗いだけの塊を「陰を持つ石」に変える。
      // 苔が育つほど跳ね返る光も増えるので m に連動させる
      nsEllipse(318, 562, 46, 14, solid(C.stoneBounce), { opacity: 0.24 * (0.35 + 0.65 * m), blur: 7 }),
      // 天端の面。側面との境=稜線でくっきり切れることが立体の芯になる
      { kind: 'path', d: STONE_MAIN_TOP_D, transform: nsPath(), paint: ref('stoneTop') },
      // 天端に乗る斑(面を作ってから置く。天端が均一だと今度は板に見える)
      nsEllipse(424, 506, 15, 5, solid(C.stoneMottleDark), { opacity: 0.1, blur: 4 }),
      nsEllipse(378, 496, 13, 4, solid(C.stoneMottleLight), { opacity: 0.12, blur: 4 }),
    );
    if (skirtOp > 0.01) {
      stonePrims.push({ kind: 'path', d: STONE_MAIN_SKIRT_D, transform: nsPath(), paint: solid(C.mossSkirt), opacity: skirtOp });
    }
    stonePrims.push(tuftPrim(352, 576, 0.7, undefined, m < 0.15));
    stonePrims.push(tuftPrim(410, 610, 0.45 * (0.8 + 0.2 * m), undefined, m < 0.3));
    stonePrims.push(tuftPrim(305, 602, 0.4 * (0.8 + 0.2 * m), -6, m < 0.3));
    for (const [dx, dy, r] of [[416, 586, 2.6], [300, 580, 2.2], [380, 606, 2]] as const) {
      stonePrims.push({ kind: 'circle', cx: wx(dx), cy: wy(dy), r: r * SX, paint: solid(C.mossPatch) });
    }
  }
  if (g.stones >= 2) {
    stonePrims.push(
      nsEllipse(ramp(w, [[0, 854], [6, 850], [12, 846]]), ramp(w, [[0, 642], [6, 644], [12, 644]]),
        ramp(w, [[0, 62], [6, 66], [12, 70]]), ramp(w, [[0, 12], [6, 13], [12, 14]]),
        solid(C.shadowInk), { opacity: 0.13 * shadowOp, blur: 6 }),
      { kind: 'path', d: STONE_COMP_D, transform: nsPath(2, -2), paint: ref('rimLight'),
        opacity: ramp(w, [[0, 0.32], [12, 0.44]]) },
      { kind: 'path', d: STONE_COMP_D, transform: nsPath(), paint: ref('stone') },
      nsEllipse(848, 604, 16, 6, solid(C.stoneMottleDark), { opacity: 0.18, blur: 4 }),
      nsEllipse(845, 618, 30, 10, solid(C.stoneBounce), { opacity: 0.22 * (0.35 + 0.65 * m), blur: 6 }),
      { kind: 'path', d: STONE_COMP_TOP_D, transform: nsPath(), paint: ref('stoneTop') },
      nsEllipse(912, 580, 11, 4, solid(C.stoneMottleDark), { opacity: 0.1, blur: 4 }),
    );
    if (skirtOp > 0.01) {
      stonePrims.push({ kind: 'path', d: STONE_COMP_SKIRT_D, transform: nsPath(), paint: solid(C.mossSkirt), opacity: skirtOp });
    }
  }
  if (g.stones >= 3) {
    const D = { dx: -665, dy: 83 };
    stonePrims.push(
      nsEllipse(214, 706, 58, 12, solid(C.shadowInk), { opacity: 0.13 * shadowOp, blur: 6 }),
      { kind: 'path', d: STONE_COMP_D, transform: nsPath(D.dx + 2, D.dy - 2), paint: ref('rimLight'),
        opacity: ramp(w, [[0, 0.32], [12, 0.44]]) },
      { kind: 'path', d: STONE_COMP_D, transform: nsPath(D.dx, D.dy), paint: ref('stone') },
      nsEllipse(848 + D.dx, 604 + D.dy, 16, 6, solid(C.stoneMottleDark), { opacity: 0.18, blur: 4 }),
      nsEllipse(845 + D.dx, 618 + D.dy, 30, 10, solid(C.stoneBounce),
        { opacity: 0.22 * (0.35 + 0.65 * m), blur: 6 }),
      { kind: 'path', d: STONE_COMP_TOP_D, transform: nsPath(D.dx, D.dy), paint: ref('stoneTop') },
    );
    if (skirtOp > 0.01) {
      stonePrims.push({ kind: 'path', d: STONE_COMP_SKIRT_D, transform: nsPath(D.dx, D.dy), paint: solid(C.mossSkirt), opacity: skirtOp });
    }
  }
  pathGroups.push({ wobble: 'soft', prims: stonePrims });
  push('path', 1.0, pathGroups);

  // ---- 竹の長い影 (0.8)。§変更2: 光が届いた所にだけ落ちる。石畳を渡るため道の上に描く
  const shadowFrontY = (pts: number[]) => Math.max(...pts.filter((_, i) => i % 2 === 1));
  const worldPts = (pts: number[]) => pts.map((v, i) => (i % 2 === 0 ? wx(v) : wy(v)));
  const shadowPrims: Prim[] = [];
  TRUNK_SHADOWS.forEach(([pts, opFull]) => {
    const op = opFull * lightVisAt(frontY, shadowFrontY(pts));
    if (op <= 0.005) return;
    shadowPrims.push({ kind: 'polygon', points: worldPts(pts), paint: solid(C.trunkShadow), opacity: op });
  });
  const branchPrims: Prim[] = BRANCH_SHADOWS.flatMap(([pts, opFull]) => {
    const op = opFull * lightVisAt(frontY, shadowFrontY(pts));
    return op > 0.005 ? [{ kind: 'polygon', points: worldPts(pts), paint: solid(C.trunkShadow), opacity: op } as Prim] : [];
  });
  push('trunk-shadows', 0.8, [
    { blur: 5, prims: shadowPrims },
    { blur: 5, prims: branchPrims },
  ]);

  // ---- 前景の苔 (1.1)
  const foreGroups: SceneGroup[] = [];
  const blobPrims: Prim[] = [];
  // 前景の苔面は房より先に現れる(閾値 0.05/0.42)。「整った」印象は連続面が作る
  FORE_BLOBS.forEach(([cx, cy, rx, ry, deep, r42]) => {
    const thr = r42 != null ? 0.05 : 0.42;
    if (m < thr) return;
    const k = r42 != null
      ? (m <= 0.5 ? lerp(0.5 * r42, r42, (m - thr) / (0.5 - thr)) : lerp(r42, 1, (m - 0.5) / 0.5))
      : lerp(0.6, 1, (m - thr) / (1 - thr));
    blobPrims.push(nsEllipse(cx, cy, rx * k, ry * k, ref(deep ? 'mossDeep' : 'mossMid')));
  });
  foreGroups.push({ wobble: 'strong', prims: blobPrims });
  const foreThr = tuftThresholds(FORE_TUFTS);
  const forePrims: Prim[] = [];
  FORE_TUFTS.forEach((t, i) => {
    const s = tuftScaleAt(t, foreThr[i], m);
    if (s != null) forePrims.push(tuftPrim(t.x, t.y, s, t.rot));
  });
  foreGroups.push({ wobble: 'soft', prims: forePrims });
  // 朱のひとひら(Day 84 のみ)
  if (g.redLeaf) {
    foreGroups.push({
      prims: [{
        kind: 'path',
        d: 'M0,-10 L3,-3 L10,-4 L5,2 L7,9 L0,5 L-7,9 L-5,2 L-10,-4 L-3,-3 Z',
        transform: { tx: wx(760), ty: wy(684), scale: 1.5 * SX, rotateDeg: 24 },
        paint: solid(C.shu),
      }],
    });
  }
  push('fore', 1.1, foreGroups);

  // ---- 日なた苔 (1.1)。手前の光だまりを前景の苔の上にもう一度淡く重ね、
  // 光の中の苔だけが黄緑に輝く(日なた=暖・明/日陰=冷・深の色温度分離。西芳寺の「光る苔」)
  const glowPrims: Prim[] = [];
  LIGHT_POOLS.forEach(([cx, cy, rx, ry, rot, opFull]) => {
    if (cy < 520) return; // 苔と重なる手前の光だまりのみ
    const op = opFull * 0.55 * lightVisAt(frontY, cy);
    if (op <= 0.005) return;
    glowPrims.push(nsEllipse(cx, cy, rx * 0.92, ry * 0.92, solid(C.mossSunGlow), { rotateDeg: rot, opacity: op }));
  });
  push('moss-glow', 1.1, [{ blur: 5, prims: glowPrims }]);

  // ---- 光条 (0.45)。右上の光源から斜めに(§変更3: 暖色 rayG)
  const shaftK = 0.12 + 0.88 * reach;
  const shaftPrims: Prim[] = [];
  LIGHT_SHAFTS.forEach(([pts, opFull]) => {
    const op = opFull * shaftK;
    if (op <= 0.005) return;
    shaftPrims.push({ kind: 'polygon', points: worldPts(pts), paint: solid(C.lightShaft), opacity: op });
  });
  push('light-shafts', 0.45, [{ blur: 16, prims: shaftPrims }]);

  // ---- 庭に立つ竹(§変更6)。竹林と庭を地続きに見せる。前景(光条の手前)に立つ。
  // ホーム(90%視界)には左端奥1本(t≈0.08)・右端奥1本(t≈0.18)が視界の端に掛かる。
  // 開扉時の翼の竹(左2・右3)は §変更2(絵巻)で翼と一緒にフェードインさせる。
  push('garden-bamboo', 1.0, [
    {
      prims: [
        ...gardenCulmPrims(1015, 0.08, HORIZON_Y + 150),
        ...gardenCulmPrims(2272, 0.18, HORIZON_Y + 105),
      ],
    },
  ]);

  // ---- 翼(左右の拡張。§変更2)。id 'wing-' 始まり = 絵巻で開扉時にフェードイン。
  // ホームの窓(中央パネル)には現れず、絵巻でスワイプすると視界に入る。
  for (const wl of buildWingLayers(m, frontY, reach)) {
    const nonEmpty = wl.groups.filter((gr) => gr.prims.length > 0);
    if (nonEmpty.length) layers.push({ ...wl, groups: nonEmpty });
  }

  return {
    worldWidth: WORLD_W,
    worldHeight: WORLD_H,
    frameX: FRAME_X,
    frameWidth: FRAME_W,
    horizonY: HORIZON_Y,
    paints: buildPaints(g),
    layers,
    overlay: { grain: true, vignette: true },
  };
}

// gardenCulmPrims / GRAIN は変更6・レンダラで使用(re-export で参照点を明示)
export { gardenCulmPrims } from './bamboo';
export { GRAIN };
