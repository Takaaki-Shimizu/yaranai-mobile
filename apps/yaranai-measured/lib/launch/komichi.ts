// 起動演出「小径」の竹林コンポジション(起動演出指示書 §2)。
// モック yaranai-launch-eyelevel-3patterns.html 案1(mockP)のシード付き手続き生成を移植。
// シードは 84210 に固定し、全ユーザー・全起動で同一の一点物とする(§2.4)。
// ユーザーの庭データ(記録日数・朱のひとひら等)は一切参照しない(§2.4)。
//
// このモジュールは純粋なデータ生成のみ(React/Skia 非依存)。描画は
// components/launch/bake.ts が担う。乱数の消費順はモックのソース順と
// 一致させてあり、同じシードから同じ構図が出る。順序を変えると絵が変わるので注意。

import { mulberry32, pick, range, type Rng } from '../garden/prng';

export const KOMICHI_SEED = 84210;

/** モックの viewBox。実解像度へは coverTransform でスケールする */
export const SCENE_W = 300;
export const SCENE_H = 640;

/** 消失点(参道の開口部)。カメラ静定の原点でもある(§4) */
export const VANISHING_POINT = { x: 150, y: 310 } as const;

/** 末すぼまり: 頂部幅/根本幅(§2.1) */
export const TAPER = 0.82;

// ---------------------------------------------------------------- プリミティブ

export type KomichiPrim =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; color: string; opacity?: number }
  | { kind: 'poly'; pts: number[]; color: string; opacity?: number }
  | {
      kind: 'line';
      x1: number; y1: number; x2: number; y2: number;
      color: string; width: number; opacity?: number; round?: boolean;
    }
  | { kind: 'circle'; cx: number; cy: number; r: number; color: string; opacity: number }
  | {
      kind: 'ellipse';
      cx: number; cy: number; rx: number; ry: number;
      /** 回転はクラスタ中心(px,py)まわり(モックの rotate(deg cx cy) と同じ) */
      rotateDeg: number; px: number; py: number;
      color: string; opacity: number;
    };

export type StalkLayer = 'deep' | 'mid' | 'near';

/** 竹1本。プリミティブに加え、検証(テスト)用の幾何メタデータを持つ */
export type Stalk = {
  layer: StalkLayer;
  /** 根本の中心X・頂部の中心X(傾き=頂部が中央へ倒れ込む) */
  x: number; topX: number;
  yB: number; yT: number;
  /** 根本の半幅 */
  w: number;
  prims: KomichiPrim[];
  /** 節のY座標(根本→頂部の順)。simple(遠層)は空 */
  nodeYs: number[];
};

export type KomichiScene = {
  /** 参道・土手・笹の斑点・竹垣(描画は deep の上・mid の下) */
  ground: KomichiPrim[];
  /** 竹24本(片側12×両側)。描画順は deep → (ground) → mid → near */
  stalks: Stalk[];
  /** 頭上の葉叢。開口部(中央)は空けてある(§2.2) */
  canopy: KomichiPrim[];
};

// ---------------------------------------------------------------- 環境の定数

/** 空(mockP soraP): objectBoundingBox 基準の radial */
export const KOMICHI_SKY = {
  center: [0.5, 0.47] as const,
  radius: 0.8,
  stops: [
    { offset: 0, color: '#e8ecd2' },
    { offset: 0.4, color: '#b8bea6' },
    { offset: 1, color: '#7f8871' },
  ],
} as const;

/** 口径食(mockP kuchieP): 四隅の沈み */
export const KOMICHI_VIGNETTE = {
  center: [0.5, 0.45] as const,
  radius: 0.95,
  color: '#1e261a',
  stops: [
    { offset: 0, opacity: 0 },
    { offset: 0.6, opacity: 0 },
    { offset: 1, opacity: 0.32 },
  ],
} as const;

/** 和紙の粒子(mockP grainP 相当)。周波数はベイク画素基準 */
export const KOMICHI_GRAIN = { baseFrequency: 0.85, octaves: 2, opacity: 0.12 } as const;

/**
 * 光・文字・影の暈のレイアウト(シーン座標)。モックの CSS 配置から換算:
 * gCore left30 top200 240×210 → 中心(150,305)、gA left-16 top430 140×110 → 中心(54,485)、
 * gB right-20 top396 150×120 → 中心(245,456)。radial-gradient closest-side は
 * 「rx=幅/2, ry=高さ/2 の楕円グラデ」に等しい。
 */
export const KOMICHI_LAYOUT = {
  moji: '#f3f0e4',
  /** 題字ブロック上端 = 画面上端から41%(§3) */
  brandTop: SCENE_H * 0.41,
  title: { text: 'Yaranai', fontSize: 26, letterSpacing: 13 },
  copy: { text: 'ここから、変わる。', fontSize: 13, letterSpacing: 4.42, marginTop: 16 },
  /** 可読性の保険: 文字背後の影の暈(§3)。中心は中心光とほぼ同じ */
  halo: { cx: 150, cy: 300, rx: 125, ry: 80, color: '22,28,18', alpha: 0.34, fade: 0.76 },
  lights: {
    core: { cx: 150, cy: 305, rx: 120, ry: 105, color: '248,246,222', alpha: 0.95, fade: 0.7 },
    left: { cx: 54, cy: 485, rx: 70, ry: 55, color: '246,244,222', alpha: 0.6, fade: 0.72 },
    right: { cx: 245, cy: 456, rx: 75, ry: 60, color: '246,244,222', alpha: 0.6, fade: 0.72 },
  },
} as const;

/**
 * シーン(300×640)を画面いっぱいに敷くカバー変換。
 * 中央基準: はみ出す辺は左右(または上下)均等に切る。消失点はほぼ画面中央に残る。
 */
export function coverTransform(width: number, height: number): { s: number; ox: number; oy: number } {
  const s = Math.max(width / SCENE_W, height / SCENE_H);
  return { s, ox: (width - SCENE_W * s) / 2, oy: (height - SCENE_H * s) / 2 };
}

// ---------------------------------------------------------------- 生成

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type StalkCfg =
  | { kind: 'simple'; cols: readonly string[]; opMin: number; opMax: number }
  | {
      kind: 'tone';
      dark: string; mid: string; hi: string;
      node: string; nodeHi: string; nodeGap: number;
    };

/**
 * 竹1本(モックの stalkV)。根本(x,yB)→頂部(x+tilt,yT)、根本半幅 w。
 * tone は 地(陰)・胴(明帯)・稜線(細い光)の3トーン + 節(暗線+根本側の明帯)の2本組(§2.1)。
 */
function stalk(
  rnd: Rng, layer: StalkLayer,
  x: number, yB: number, yT: number, w: number, tilt: number, cfg: StalkCfg,
): Stalk {
  const rr = (a: number, b: number) => range(rnd, a, b);
  const xt = x + tilt;
  const wt = w * TAPER;
  const quad = (c: number, wf: number): number[] => [
    x + w * (c - wf), yB,
    x + w * (c + wf), yB,
    xt + wt * (c + wf), yT,
    xt + wt * (c - wf), yT,
  ];
  const prims: KomichiPrim[] = [];
  const nodeYs: number[] = [];
  if (cfg.kind === 'simple') {
    prims.push({ kind: 'poly', pts: quad(0, 1), color: pick(rnd, cfg.cols), opacity: rr(cfg.opMin, cfg.opMax) });
  } else {
    const side = rnd() < 0.5 ? 1 : -1;
    prims.push({ kind: 'poly', pts: quad(0, 1), color: cfg.dark });
    prims.push({ kind: 'poly', pts: quad(0.12 * side, 0.58), color: cfg.mid });
    prims.push({ kind: 'poly', pts: quad(-0.34 * side, 0.17), color: cfg.hi, opacity: 0.85 });
    // 節: 暗い線 + 根本側の明帯。間隔 nodeGap は呼び出し側で層ごとに決める
    let y = yB - rr(24, 52);
    while (y > yT + 14) {
      const t = (yB - y) / (yB - yT);
      const lx = lerp(x, xt, t);
      const lw = lerp(w, wt, t);
      prims.push({
        kind: 'line', x1: lx - lw, y1: y, x2: lx + lw, y2: y,
        color: cfg.node, width: Math.max(0.9, lw * 0.22), round: true,
      });
      const dy = Math.max(1.3, lw * 0.26);
      prims.push({
        kind: 'line', x1: lx - lw * 0.9, y1: y + dy, x2: lx + lw * 0.9, y2: y + dy,
        color: cfg.nodeHi, width: Math.max(0.7, lw * 0.12), opacity: 0.8,
      });
      nodeYs.push(y);
      y -= cfg.nodeGap * rr(0.85, 1.2);
    }
  }
  return { layer, x, topX: xt, yB, yT, w, prims, nodeYs };
}

/** 土手のきめ(笹の斑点)(モックの speckles) */
function speckles(
  rnd: Rng, out: KomichiPrim[], n: number,
  x0: number, x1: number, y0: number, y1: number, color: string, opacity: number,
): void {
  const rr = (a: number, b: number) => range(rnd, a, b);
  for (let i = 0; i < n; i++) {
    out.push({ kind: 'circle', cx: rr(x0, x1), cy: rr(y0, y1), r: rr(0.9, 1.5), color, opacity });
  }
}

/** 葉のクラスタ(モックの leafCluster)。回転はクラスタ中心まわり */
function leafCluster(
  rnd: Rng, out: KomichiPrim[], cx: number, cy: number, m: number,
  cols: readonly string[], opMin: number, opMax: number, baseAng: number,
): void {
  const rr = (a: number, b: number) => range(rnd, a, b);
  for (let j = 0; j < m; j++) {
    out.push({
      kind: 'ellipse',
      cx: cx + rr(-16, 16), cy: cy + rr(-10, 10),
      rx: rr(10, 22), ry: rr(3, 6.5),
      rotateDeg: baseAng + rr(-24, 24), px: cx, py: cy,
      color: pick(rnd, cols), opacity: rr(opMin, opMax),
    });
  }
}

/**
 * 小径の一点物コンポジションを生成する。呼ぶたび同一(シード固定・引数なし)。
 * 生成順(=乱数消費順)はモックの mockP ブロックと同一。
 */
export function buildKomichiScene(): KomichiScene {
  const rnd = mulberry32(KOMICHI_SEED);
  const rr = (a: number, b: number) => range(rnd, a, b);
  const VPx = VANISHING_POINT.x;

  // 地面と土手・参道・竹垣
  const ground: KomichiPrim[] = [];
  ground.push({ kind: 'rect', x: 0, y: 302, w: 300, h: 338, color: '#66784e' });
  // 参道: 下端(幅広)→開口部(幅狭)へ収束。2トーン(§2.2)
  ground.push({ kind: 'poly', pts: [143, 312, 157, 312, 243, 640, 57, 640], color: '#b1aa95' });
  ground.push({ kind: 'poly', pts: [146, 312, 154, 312, 206, 640, 94, 640], color: '#bcb5a0', opacity: 0.6 });
  // 土手(笹)
  ground.push({ kind: 'poly', pts: [0, 640, 0, 430, 58, 348, 140, 316, 54, 640], color: '#4e6039' });
  ground.push({ kind: 'poly', pts: [300, 640, 300, 430, 242, 348, 160, 316, 246, 640], color: '#485935' });
  speckles(rnd, ground, 26, 4, 120, 380, 630, '#8ba368', 0.5);
  speckles(rnd, ground, 26, 180, 296, 380, 630, '#8ba368', 0.5);
  // 竹垣: 消失点へ収束する横木 + 支柱(§2.2)
  ground.push({ kind: 'line', x1: 136, y1: 322, x2: 30, y2: 640, color: '#6b6350', width: 2.6 });
  ground.push({ kind: 'line', x1: 164, y1: 322, x2: 270, y2: 640, color: '#6b6350', width: 2.6 });
  for (const [px, py] of [[126, 352], [104, 418], [76, 502], [42, 604]] as const) {
    ground.push({ kind: 'line', x1: px, y1: py, x2: px, y2: py + 26, color: '#5d5748', width: 2.2 });
    ground.push({ kind: 'line', x1: 300 - px, y1: py, x2: 300 - px, y2: py + 26, color: '#5d5748', width: 2.2 });
  }

  // 竹の壁: 片側12本×両側。横位置・太さ・高さ・傾きの4要素が消失点へ収束(§2.1)
  const stalks: Stalk[] = [];
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < 12; i++) {
      const d = i / 11; // 0=手前 1=最奥
      const xoff = lerp(158, 26, Math.pow(d, 0.82)) * rr(0.94, 1.07);
      const x = VPx + s * xoff;
      const w = lerp(12.5, 2.2, d);
      const tilt = -s * lerp(24, 4, d) * rr(0.8, 1.15); // 頂部が中央へ倒れ込む
      const yB = lerp(700, 332, Math.pow(d, 1.1));
      const yT = lerp(-40, 216, d);
      if (d > 0.66) {
        stalks.push(stalk(rnd, 'deep', x, yB, yT, w, tilt, {
          kind: 'simple', cols: ['#b5bba2', '#c0c6ad', '#a9af96'], opMin: 0.5, opMax: 0.75,
        }));
      } else if (d > 0.3) {
        stalks.push(stalk(rnd, 'mid', x, yB, yT, w, tilt, {
          kind: 'tone', dark: '#4b5f40', mid: '#6c8458', hi: '#93aa7c',
          node: '#37492e', nodeHi: '#9db386', nodeGap: rr(42, 60),
        }));
      } else {
        stalks.push(stalk(rnd, 'near', x, yB, yT, w, tilt, {
          kind: 'tone', dark: '#33452c', mid: '#587347', hi: '#8ba573',
          node: '#273620', nodeHi: '#a4ba8c', nodeGap: rr(56, 84),
        }));
      }
    }
  }

  // 頭上の葉叢: 上部両肩に濃く、開口部(中央)は空ける(§2.2)。中央帯は最上部のみ薄く
  const canopy: KomichiPrim[] = [];
  for (let i = 0; i < 9; i++) {
    leafCluster(rnd, canopy, rr(-8, 92), rr(-6, 120), 3, ['#3c4f34', '#48603d', '#54684a'], 0.55, 0.85, rr(-30, 30));
  }
  for (let i = 0; i < 9; i++) {
    leafCluster(rnd, canopy, rr(208, 308), rr(-6, 120), 3, ['#3c4f34', '#48603d', '#54684a'], 0.55, 0.85, rr(-30, 30));
  }
  for (let i = 0; i < 5; i++) {
    leafCluster(rnd, canopy, rr(100, 200), rr(-10, 44), 3, ['#55684a', '#5f7551'], 0.4, 0.6, rr(-20, 20));
  }

  return { ground, stalks, canopy };
}
