// 版下(card-spec)をSVGに起こす開発用の照合器。Skiaには依存しない。
//
//   npx tsc -p tsconfig.test.json && node scripts/render-excuse-cards.js <outDir>
//
// components/excuse/bake.ts が描くのと同じ順・同じ数値を、SVGの語彙で並べる。
// モック v3(yaranai-excuse-card-mock-v3.html)と並べて見比べるためのもので、
// 版面のずれ(文字のはみ出し、QRと預かりの一文の衝突)を実機に入れる前に見つける。
// アプリの実行時には通らない。

import {
  CARD_LAYOUTS, declarationBaselines,
  type CardLayout, type CardSize, type GradientStop,
} from './card-spec';
import { buildQrMatrix } from './qr';
import { excuseWidth } from './validate';

export type PreviewContent = {
  lines: string[];
  date: string;
  custody: string[];
  wordmark: string;
  qrLabel: string;
  url: string;
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const stops = (list: GradientStop[]) =>
  list
    .map((s) => `<stop offset="${s.offset}" stop-color="${s.color}" stop-opacity="${s.opacity ?? 1}"/>`)
    .join('');

const FONT = "'Shippori Mincho',serif";

/**
 * 宣言文の縮尺(§9-2 はみ出し禁止の保険)。bake.ts と同じく、安全幅を超える行が
 * あれば全行に同じ縮尺を掛ける。Skia は実測で縮めるが、SVGに実測は無いので
 * 「全角1字の送り ≒ font-size」の概算で見る(明朝の全角送りはこれとほぼ等しい)。
 */
export function declarationScale(L: CardLayout, lines: string[]): number {
  const d = L.declaration;
  const widest = lines.reduce((max, text) => {
    const chars = [...text].length;
    return Math.max(max, excuseWidth(text) * d.size + Math.max(0, chars - 1) * d.letterSpacing);
  }, 0);
  return widest > d.safeWidth ? d.safeWidth / widest : 1;
}

function textTag(
  text: string, cx: number, y: number, size: number, ls: number,
  fill: string, opacity = 1, filter?: string,
): string {
  if (text === '') return '';
  return (
    `<text x="${cx}" y="${y}" font-family="${FONT}" font-size="${size}" letter-spacing="${ls}" ` +
    `fill="${fill}" fill-opacity="${opacity}" text-anchor="middle"` +
    `${filter ? ` filter="${filter}"` : ''}>${esc(text)}</text>`
  );
}

export function cardToSvg(size: CardSize, content: PreviewContent): string {
  const L: CardLayout = CARD_LAYOUTS[size];
  const d = L.declaration;
  const lines = content.lines.slice(0, 2);
  const baselines = declarationBaselines(L, lines.length);

  const defs = `<defs>
    <linearGradient id="night" x1="0" y1="0" x2="0" y2="1">${stops(L.night)}</linearGradient>
    <radialGradient id="glow" cx="${L.glow.center[0]}" cy="${L.glow.center[1]}" r="${L.glow.radius}">${stops(L.glow.stops)}</radialGradient>
    <radialGradient id="glowCore" cx="${L.glowCore.center[0]}" cy="${L.glowCore.center[1]}" r="${L.glowCore.radius}">${stops(L.glowCore.stops)}</radialGradient>
    <linearGradient id="path" x1="0" y1="0" x2="0" y2="1">${stops(L.path.stops)}</linearGradient>
    <filter id="bambooBlur"><feGaussianBlur stdDeviation="${L.bamboo.blur}"/></filter>
    <filter id="pathBlur"><feGaussianBlur stdDeviation="${L.path.blur}"/></filter>
    <filter id="textGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="${d.glowBlur}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="b"/></feMerge>
    </filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="${L.grain.baseFrequency}" numOctaves="${L.grain.octaves}" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 ${L.grain.rgb[0]}  0 0 0 0 ${L.grain.rgb[1]}  0 0 0 0 ${L.grain.rgb[2]}  0 0 0 ${L.grain.alpha} 0"/>
      <feComposite operator="in" in2="SourceGraphic"/>
    </filter>
  </defs>`;

  const bamboo = `<g filter="url(#bambooBlur)">
    ${L.bamboo.culms
      .map((c) =>
        `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="${c.r}" fill="${c.color}" fill-opacity="${c.opacity ?? 1}"/>`)
      .join('')}
    ${[...L.bamboo.nodes, ...L.bamboo.rims]
      .map((s) =>
        `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${s.color}" stroke-width="${s.w}" stroke-opacity="${s.opacity}"/>`)
      .join('')}
  </g>`;

  const stone = `<g filter="url(#pathBlur)">
    <polygon points="${L.path.polygon.join(',')}" fill="url(#path)"/>
    ${L.path.joints
      .map((s) =>
        `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${s.color}" stroke-width="${s.w}" stroke-opacity="${s.opacity}"/>`)
      .join('')}
  </g>`;

  // 宣言文は二層描き。下にぼかした光量の層、上に輪郭の層(§5-3)。
  // 安全幅を超える行があれば、字送りごと全行を同じ縮尺で縮める(§9-2)
  const scale = declarationScale(L, lines);
  const dSize = d.size * scale;
  const dLs = d.letterSpacing * scale;
  const declaration = `<g>
    <g filter="url(#textGlow)" opacity="${d.glowOpacity}">
      ${lines.map((line, i) => textTag(line, d.cx, baselines[i], dSize, dLs, d.glowColor)).join('')}
    </g>
    ${lines.map((line, i) => textTag(line, d.cx, baselines[i], dSize, dLs, d.color)).join('')}
  </g>`;

  const custody = content.custody
    .slice(0, L.custody.baselines.length)
    .map((line, i) =>
      textTag(line, L.custody.cx, L.custody.baselines[i], L.custody.size, L.custody.letterSpacing, L.custody.color, L.custody.opacity))
    .join('');

  const q = L.qr;
  const matrix = buildQrMatrix(content.url);
  const across = matrix.length + q.quietModules * 2;
  const module = Math.max(1, Math.round(q.size / across));
  const panel = module * across;
  const originX = q.x + q.quietModules * module;
  const originY = q.y + q.quietModules * module;
  const modules = matrix
    .map((row, r) =>
      row
        .map((dark, c) =>
          dark
            ? `<rect x="${originX + c * module}" y="${originY + r * module}" width="${module}" height="${module}"/>`
            : '')
        .join(''))
    .join('');
  const qr = `<g>
    <rect x="${q.x}" y="${q.y}" width="${panel}" height="${panel}" rx="2" fill="${q.panelColor}" fill-opacity="${q.panelOpacity}"/>
    <g fill="${q.moduleColor}" fill-opacity="${q.moduleOpacity}">${modules}</g>
    ${textTag(content.qrLabel, q.x + panel / 2, q.label.y, q.label.size, q.label.letterSpacing, q.label.color)}
  </g>`;

  return `<svg viewBox="0 0 ${L.width} ${L.height}" width="${L.width}" height="${L.height}" xmlns="http://www.w3.org/2000/svg">
${defs}
<rect width="${L.width}" height="${L.height}" fill="url(#night)"/>
${bamboo}
<rect width="${L.width}" height="${L.height}" fill="url(#glow)"/>
<rect width="${L.width}" height="${L.height}" fill="url(#glowCore)"/>
${stone}
${declaration}
${textTag(content.date, L.date.cx, L.date.y, L.date.size, L.date.letterSpacing, L.date.color)}
${custody}
${textTag(content.wordmark, L.wordmark.cx, L.wordmark.y, L.wordmark.size, L.wordmark.letterSpacing, L.wordmark.color)}
${qr}
<rect width="${L.width}" height="${L.height}" filter="url(#grain)" opacity="${L.grain.opacity}"/>
</svg>`;
}
