import { useMemo } from "react";
import Svg, {
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Circle,
} from "react-native-svg";

type Props = {
  phase?: number;
  breaks?: number;
  width?: number;
  height?: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const hexToRgb = (hex: string) => {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};

const mix = (a: string, b: string, t: number) => {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  const r = Math.round(lerp(ra.r, rb.r, t));
  const g = Math.round(lerp(ra.g, rb.g, t));
  const bl = Math.round(lerp(ra.b, rb.b, t));
  return `rgb(${r}, ${g}, ${bl})`;
};

const seededRand = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
};

const VB_W = 600;
const VB_H = 800;

export function KaresansuiGarden({
  phase = 0,
  breaks = 0,
  width = 390,
  height = 520,
}: Props) {
  const t = ease(clamp01(phase));

  const skyTop = mix("#f4ebd7", "#faf3df", t);
  const skyBottom = mix("#e7dac0", "#ede0c4", t);

  const sandColor = mix("#d6c8a8", "#f1e9d0", t);
  const sandShade = mix("#bba886", "#dfcca5", t);

  const pondInner = mix("#6b5d3e", "#a8cdda", t);
  const pondOuter = mix("#4f4630", "#86b3c4", t);

  const ridgeFar = "#665744";
  const ridgeNear = "#7a6a55";
  const ridgeOpacity = lerp(0.05, 0.35, t);

  const stones = [
    { cx: 380, cy: 440, rx: 56, ry: 38, tilt: lerp(-14, 0, t), shade: "#5a564f" },
    { cx: 320, cy: 470, rx: 36, ry: 26, tilt: lerp(8, 0, t), shade: "#4a463f" },
    { cx: 430, cy: 490, rx: 28, ry: 20, tilt: lerp(-6, 0, t), shade: "#52504a" },
  ];

  const rakeRings = Math.floor(lerp(0, 7, t));
  const mossOpacity = lerp(0, 1, t);
  const mossR = lerp(8, 18, t);
  const weedOpacity = lerp(0.85, 0, t);

  const leaves = useMemo(() => {
    const rnd = seededRand(7);
    return Array.from({ length: Math.min(breaks, 8) }, () => {
      const r1 = rnd();
      const r2 = rnd();
      const r3 = rnd();
      return {
        x: 80 + r1 * 480,
        y: 380 + r2 * 320,
        rot: r3 * 360,
        // hue 28..46 → reds-oranges; convert to fixed warm autumn color
        hue: r3,
      };
    });
  }, [breaks]);

  const leafColor = (h: number) => {
    // h 0..1 → blend between burnt-orange and ochre
    return mix("#b8602d", "#c98a3d", h);
  };
  const leafVein = (h: number) => mix("#7a3d1c", "#8a5a26", h);

  const mossPalette = [
    "#7a8b4a",
    "#6f8543",
    "#849957",
    "#94a866",
    "#7d934e",
  ];

  const stoneSpotColor = "#6f7a4e";
  const pineColor = "#3f3a2c";
  const pineNeedle = "#4f5a36";

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <Defs>
        <LinearGradient id="ks-sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={skyTop} />
          <Stop offset="1" stopColor={skyBottom} />
        </LinearGradient>
        <LinearGradient id="ks-sand" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={sandColor} />
          <Stop offset="1" stopColor={sandShade} />
        </LinearGradient>
        <RadialGradient id="ks-pond" cx="0.4" cy="0.5" rx="0.6" ry="0.6">
          <Stop offset="0" stopColor={pondInner} />
          <Stop offset="1" stopColor={pondOuter} />
        </RadialGradient>
      </Defs>

      <Rect x={0} y={0} width={VB_W} height={VB_H} fill="url(#ks-sky)" />

      <Path
        d="M 0 280 Q 80 240, 160 260 T 320 250 Q 420 230, 520 255 T 720 250 L 720 320 L 0 320 Z"
        fill={ridgeFar}
        opacity={ridgeOpacity}
      />
      <Path
        d="M 0 320 Q 100 290, 200 310 T 380 300 Q 480 285, 600 305 L 600 360 L 0 360 Z"
        fill={ridgeNear}
        opacity={ridgeOpacity * 0.9}
      />

      <Rect x={0} y={320} width={VB_W} height={480} fill="url(#ks-sand)" />

      <G opacity={lerp(0.85, 1, t)}>
        <Path
          d="M 30 470 Q 10 540, 60 600 Q 130 660, 220 640 Q 280 620, 270 560 Q 250 480, 170 460 Q 80 450, 30 470 Z"
          fill="url(#ks-pond)"
        />
        {t > 0.4 &&
          [0, 1, 2].map((i) => (
            <Ellipse
              key={i}
              cx={lerp(140, 130, i / 2)}
              cy={lerp(540, 555, i / 2)}
              rx={lerp(40, 70, i / 2)}
              ry={lerp(8, 14, i / 2)}
              fill="none"
              stroke="#dde9ed"
              strokeWidth={1}
              opacity={lerp(0, 0.4, t) * (1 - i * 0.25)}
            />
          ))}
        {t > 0.7 && (
          <Ellipse
            cx={180}
            cy={530}
            rx={14}
            ry={9}
            fill="#7da25c"
            opacity={lerp(0, 0.85, (t - 0.7) / 0.3)}
          />
        )}
      </G>

      {rakeRings > 0 && (
        <G opacity={0.42}>
          {Array.from({ length: rakeRings }).map((_, i) => {
            const r = 100 + i * 28;
            return (
              <Ellipse
                key={i}
                cx={380}
                cy={470}
                rx={r * 1.15}
                ry={r * 0.7}
                fill="none"
                stroke="#9a8a6c"
                strokeWidth={1}
              />
            );
          })}
        </G>
      )}

      {t > 0.3 && (
        <G opacity={lerp(0, 0.35, (t - 0.3) / 0.7)}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Line
              key={i}
              x1={0}
              x2={VB_W}
              y1={350 + i * 56}
              y2={350 + i * 56}
              stroke="#9a8a6c"
              strokeWidth={0.8}
            />
          ))}
        </G>
      )}

      {weedOpacity > 0.02 && (
        <G opacity={weedOpacity}>
          {[
            [120, 380],
            [250, 410],
            [410, 360],
            [490, 420],
            [180, 480],
            [340, 540],
            [510, 510],
            [80, 560],
            [430, 580],
            [220, 620],
            [550, 640],
            [380, 650],
          ].map(([x, y], i) => (
            <Path
              key={i}
              d={`M ${x} ${y} L ${x - 3} ${y - 14} M ${x} ${y} L ${x} ${y - 18} M ${x} ${y} L ${x + 4} ${y - 12}`}
              stroke="#637540"
              strokeWidth={1.4}
              strokeLinecap="round"
              fill="none"
            />
          ))}
        </G>
      )}

      {stones.map((s, i) => (
        <G key={i} transform={`translate(${s.cx} ${s.cy}) rotate(${s.tilt})`}>
          <Ellipse
            cx={2}
            cy={s.ry * 0.85}
            rx={s.rx * 0.95}
            ry={s.ry * 0.25}
            fill="#3a3530"
            opacity={0.18}
          />
          <Path
            d={`M ${-s.rx} 0 Q ${-s.rx} ${-s.ry * 1.1}, ${-s.rx * 0.3} ${-s.ry * 0.95} Q ${s.rx * 0.3} ${-s.ry * 1.05}, ${s.rx} ${-s.ry * 0.6} Q ${s.rx * 1.05} ${s.ry * 0.4}, ${s.rx * 0.5} ${s.ry * 0.8} Q ${-s.rx * 0.5} ${s.ry * 0.95}, ${-s.rx} 0 Z`}
            fill={s.shade}
            stroke="#2c2924"
            strokeWidth={0.5}
          />
          <Ellipse
            cx={-s.rx * 0.25}
            cy={-s.ry * 0.45}
            rx={s.rx * 0.45}
            ry={s.ry * 0.25}
            fill="#bdb6a8"
            opacity={lerp(0.18, 0.3, t)}
          />
          {t < 0.5 &&
            [0, 1, 2].map((j) => (
              <Circle
                key={j}
                cx={lerp(-s.rx * 0.5, s.rx * 0.5, j / 2)}
                cy={s.ry * 0.2 + j * 4 - 6}
                r={2.5}
                fill={stoneSpotColor}
                opacity={lerp(0.6, 0, t) * 0.6}
              />
            ))}
        </G>
      ))}

      <G opacity={mossOpacity}>
        {[
          [460, 700],
          [510, 690],
          [550, 710],
          [490, 730],
          [530, 740],
          [570, 730],
          [440, 730],
          [580, 760],
          [510, 760],
          [420, 760],
          [600, 700],
          [475, 760],
        ].map(([x, y], i) => (
          <Ellipse
            key={i}
            cx={x}
            cy={y}
            rx={mossR + (i % 3) * 2}
            ry={mossR * 0.65}
            fill={mossPalette[i % mossPalette.length]}
            opacity={lerp(0.55, 0.85, (i % 3) / 2)}
          />
        ))}
        {t > 0.5 &&
          Array.from({ length: 18 }).map((_, i) => (
            <Circle
              key={i}
              cx={lerp(380, 600, (i % 6) / 5) + ((i * 7) % 23)}
              cy={lerp(660, 780, Math.floor(i / 6) / 2)}
              r={1.6}
              fill="#7e9650"
              opacity={lerp(0, 0.6, (t - 0.5) / 0.5)}
            />
          ))}
      </G>

      {t > 0.2 && (
        <G opacity={lerp(0, 0.8, (t - 0.2) / 0.8)}>
          <Path
            d="M 600 200 Q 540 210, 500 240 Q 460 270, 440 290"
            fill="none"
            stroke={pineColor}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Path
            d="M 540 235 Q 525 220, 510 215"
            fill="none"
            stroke={pineColor}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Path
            d="M 510 250 Q 495 245, 480 248"
            fill="none"
            stroke={pineColor}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
          {t > 0.5 &&
            [
              [490, 220],
              [475, 240],
              [445, 285],
              [510, 235],
            ].map(([x, y], i) => (
              <G
                key={i}
                transform={`translate(${x} ${y})`}
                opacity={lerp(0, 0.9, (t - 0.5) / 0.5)}
              >
                <Path
                  d="M 0 0 L -6 -4 M 0 0 L 0 -7 M 0 0 L 6 -4 M 0 0 L -5 4 M 0 0 L 5 4"
                  stroke={pineNeedle}
                  strokeWidth={1}
                  strokeLinecap="round"
                />
              </G>
            ))}
        </G>
      )}

      {leaves.map((l, i) => (
        <G key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.rot})`}>
          <Path
            d="M 0 0 Q 3 -6, 8 -4 Q 12 0, 8 4 Q 3 6, 0 0 Z"
            fill={leafColor(l.hue)}
            opacity={0.78}
          />
          <Path
            d="M 0 0 L 7 0"
            stroke={leafVein(l.hue)}
            strokeWidth={0.5}
            opacity={0.6}
          />
        </G>
      ))}
    </Svg>
  );
}
