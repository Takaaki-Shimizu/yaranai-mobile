import Svg, { Circle, Ellipse, Line, Path, Rect } from "react-native-svg";

import { koke, sumi, suna, usuzumi } from "./theme";

export type GardenStage = 0 | 1 | 2 | 3 | 4;

type Props = {
  /** garden_state ビューが返す 0〜1 の値 */
  phase: number;
  width?: number | `${number}%`;
  height?: number;
};

const VB_W = 360;
const VB_H = 220;
const LINE_X1 = 18;
const LINE_X2 = 342;
const GAP_PAD = 6;

export const stageForPhase = (phase: number): GardenStage => {
  const p = Number.isFinite(phase) ? phase : 0;
  if (p < 0.1) return 0;
  if (p < 0.3) return 1;
  if (p < 0.55) return 2;
  if (p < 0.85) return 3;
  return 4;
};

type EllipseSpec = { cx: number; cy: number; rx: number; ry: number };
type Segment = { y: number; x1: number; x2: number };

// 主石・添石・小石。位置は不等辺三角の石組。
const MAIN = { cx: 140, cy: 107 };
const COMPANION = { cx: 218, cy: 148 };
const ISLAND = { cx: 288, cy: 64 };

const STONE_MAIN =
  "M118 112 Q114 96 130 91 Q148 86 161 96 Q170 104 162 114 Q148 123 130 121 Q120 119 118 112 Z";
const STONE_COMPANION =
  "M204 150 Q203 140 214 137 Q226 134 232 141 Q237 147 231 153 Q222 158 211 156 Q205 154 204 150 Z";
const STONE_SMALL =
  "M88 157 Q88 150 96 148 Q104 146 108 151 Q111 155 106 159 Q99 162 92 160 Q89 159 88 157 Z";

const ring = (c: { cx: number; cy: number }, rx: number, ry: number): EllipseSpec => ({
  cx: c.cx,
  cy: c.cy,
  rx,
  ry,
});

// 直線の砂紋を波紋の外周で途切れさせる
const rakeSegments = (ys: number[], x1: number, zones: EllipseSpec[]): Segment[] =>
  ys.flatMap((y) => {
    const gaps = zones
      .filter((z) => Math.abs(y - z.cy) < z.ry)
      .map((z) => {
        const t = (y - z.cy) / z.ry;
        const dx = z.rx * Math.sqrt(1 - t * t) + GAP_PAD;
        return [z.cx - dx, z.cx + dx] as const;
      })
      .sort((a, b) => a[0] - b[0]);
    const segments: Segment[] = [];
    let cursor = x1;
    for (const [gapStart, gapEnd] of gaps) {
      if (gapStart > cursor) segments.push({ y, x1: cursor, x2: Math.min(gapStart, LINE_X2) });
      cursor = Math.max(cursor, gapEnd);
    }
    if (cursor < LINE_X2) segments.push({ y, x1: cursor, x2: LINE_X2 });
    return segments.filter((s) => s.x2 - s.x1 > 2);
  });

type Scene = {
  segments: Segment[];
  rings: EllipseSpec[];
  stones: string[];
  moss: EllipseSpec[];
  pebbles: { cx: number; cy: number; r: number }[];
  tufts: string[];
};

const PEBBLES = [
  { cx: 52, cy: 60, r: 2 },
  { cx: 84, cy: 132, r: 1.5 },
  { cx: 300, cy: 52, r: 2 },
  { cx: 258, cy: 96, r: 1.6 },
  { cx: 318, cy: 150, r: 2.2 },
  { cx: 196, cy: 58, r: 1.4 },
  { cx: 230, cy: 186, r: 1.8 },
  { cx: 68, cy: 196, r: 1.6 },
];

const tuft = (x: number, y: number) =>
  `M${x} ${y} l-3 -8 M${x} ${y} l1 -9 M${x} ${y} l4 -7`;

const RINGS_MAIN_2 = [ring(MAIN, 34, 17), ring(MAIN, 46, 24)];
const RINGS_MAIN_3 = [...RINGS_MAIN_2, ring(MAIN, 60, 32)];
const RING_COMPANION_1 = [ring(COMPANION, 24, 12)];
const RINGS_COMPANION_2 = [...RING_COMPANION_1, ring(COMPANION, 34, 17)];
const RING_ISLAND = [ring(ISLAND, 26, 12)];

const MOSS_MAIN: EllipseSpec[] = [
  { cx: 160, cy: 120, rx: 8, ry: 4 },
  { cx: 167, cy: 122, rx: 5, ry: 3 },
];
const MOSS_MORE: EllipseSpec[] = [
  { cx: 120, cy: 122, rx: 7, ry: 3.5 },
  { cx: 230, cy: 152, rx: 6, ry: 3 },
];
const MOSS_FULL: EllipseSpec[] = [
  { cx: 107, cy: 158, rx: 6, ry: 3 },
  { cx: 284, cy: 64, rx: 12, ry: 5 },
  { cx: 294, cy: 66, rx: 8, ry: 4 },
  { cx: 288, cy: 60, rx: 7, ry: 3.5 },
];

const RAKE_Y_MID = [34, 62, 90, 118, 146, 174, 202];
const RAKE_Y_FULL = [30, 50, 70, 90, 110, 130, 150, 170, 190, 210];

const SCENES: Record<GardenStage, Scene> = {
  // 荒れた庭 — 砂紋なし。石がひとつ、小石と枯れ草が散らばる。
  0: {
    segments: [],
    rings: [],
    stones: [STONE_MAIN],
    moss: [],
    pebbles: PEBBLES,
    tufts: [tuft(250, 150), tuft(120, 84), tuft(310, 196)],
  },
  // 砂紋が入り始める — 片側から数本だけ掃かれている。
  1: {
    segments: rakeSegments([152, 170, 188], 120, []),
    rings: [],
    stones: [STONE_MAIN],
    moss: [],
    pebbles: PEBBLES.slice(0, 4),
    tufts: [],
  },
  // 石の周りに波紋、苔が一房。
  2: {
    segments: rakeSegments(RAKE_Y_MID, LINE_X1, [ring(MAIN, 46, 24)]),
    rings: RINGS_MAIN_2,
    stones: [STONE_MAIN],
    moss: MOSS_MAIN,
    pebbles: [],
    tufts: [],
  },
  // 波紋が広がり、添石が加わり、苔が増える。
  3: {
    segments: rakeSegments(RAKE_Y_MID, LINE_X1, [ring(MAIN, 60, 32), ring(COMPANION, 24, 12)]),
    rings: [...RINGS_MAIN_3, ...RING_COMPANION_1],
    stones: [STONE_MAIN, STONE_COMPANION],
    moss: [...MOSS_MAIN, ...MOSS_MORE],
    pebbles: [],
    tufts: [],
  },
  // 整った庭 — 砂紋・石・苔・苔島が調和する。
  4: {
    segments: rakeSegments(RAKE_Y_FULL, LINE_X1, [
      ring(MAIN, 60, 32),
      ring(COMPANION, 34, 17),
      ring(ISLAND, 26, 12),
    ]),
    rings: [...RINGS_MAIN_3, ...RINGS_COMPANION_2, ...RING_ISLAND],
    stones: [STONE_MAIN, STONE_COMPANION, STONE_SMALL],
    moss: [...MOSS_MAIN, ...MOSS_MORE, ...MOSS_FULL],
    pebbles: [],
    tufts: [],
  },
};

export function Garden({ phase, width = "100%", height = 200 }: Props) {
  const scene = SCENES[stageForPhase(phase)];
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <Rect x={0} y={0} width={VB_W} height={VB_H} fill={suna} />
      {scene.segments.map((s, i) => (
        <Line
          key={`l${i}`}
          x1={s.x1}
          y1={s.y}
          x2={s.x2}
          y2={s.y}
          stroke={usuzumi}
          strokeWidth={1}
          strokeLinecap="round"
        />
      ))}
      {scene.rings.map((r, i) => (
        <Ellipse
          key={`r${i}`}
          cx={r.cx}
          cy={r.cy}
          rx={r.rx}
          ry={r.ry}
          fill="none"
          stroke={usuzumi}
          strokeWidth={1}
        />
      ))}
      {scene.pebbles.map((p, i) => (
        <Circle key={`p${i}`} cx={p.cx} cy={p.cy} r={p.r} fill={usuzumi} />
      ))}
      {scene.tufts.map((d, i) => (
        <Path
          key={`t${i}`}
          d={d}
          fill="none"
          stroke={usuzumi}
          strokeWidth={1}
          strokeLinecap="round"
        />
      ))}
      {scene.stones.map((d, i) => (
        <Path key={`s${i}`} d={d} fill={sumi} />
      ))}
      {scene.moss.map((m, i) => (
        <Ellipse key={`m${i}`} cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} fill={koke} />
      ))}
    </Svg>
  );
}
