// シーンスペック → SVG 文字列(開発用プレビュー)。
// モックとの視覚照合(受け入れ基準1)に使う。アプリ本体からは import しない。
// 揺らぎ・粒子はモックと同じ feTurbulence / feDisplacementMap / feColorMatrix を出す。

import { GARDEN_COLORS as C, GRAIN, WOBBLE_PARAMS } from './tokens';
import {
  PAN_CENTER, VIEW_LOGICAL_W, WORLD_H,
  TUFT_BALLS, TUFT_GRAINS_DARK, TUFT_GRAINS_LIGHT,
  TUFT_SIMPLE_BALLS, TUFT_SIMPLE_GRAINS_DARK, TUFT_SIMPLE_GRAINS_LIGHT,
} from './scene';
import type { Paint, Prim, Scene, Transform } from './scene-types';

const esc = (v: number) => (Math.round(v * 100) / 100).toString();

function paintDefs(paints: Record<string, Paint>): string {
  let out = '';
  for (const [name, p] of Object.entries(paints)) {
    if (p.type === 'linear') {
      out += `<linearGradient id="p-${name}" x1="${p.from[0]}" y1="${p.from[1]}" x2="${p.to[0]}" y2="${p.to[1]}">`;
      for (const s of p.stops) {
        out += `<stop offset="${s.offset}" stop-color="${s.color}"${s.opacity != null ? ` stop-opacity="${s.opacity}"` : ''}/>`;
      }
      out += '</linearGradient>';
    } else if (p.type === 'radial') {
      out += `<radialGradient id="p-${name}" cx="${p.center[0]}" cy="${p.center[1]}" r="${p.radius}">`;
      for (const s of p.stops) {
        out += `<stop offset="${s.offset}" stop-color="${s.color}"${s.opacity != null ? ` stop-opacity="${s.opacity}"` : ''}/>`;
      }
      out += '</radialGradient>';
    }
  }
  return out;
}

function fillAttr(paint: Paint | undefined, opacity?: number): string {
  if (!paint) return 'fill="none"';
  let f: string;
  if (paint.type === 'solid') f = paint.color;
  else if (paint.type === 'ref') f = `url(#p-${paint.name})`;
  else f = ''; // インライングラデーションは未使用(名前付きのみ)
  return `fill="${f}"${opacity != null ? ` fill-opacity="${esc(opacity)}"` : ''}`;
}

function transformAttr(t?: Transform): string {
  if (!t) return '';
  const parts: string[] = [];
  if (t.tx || t.ty) parts.push(`translate(${esc(t.tx ?? 0)},${esc(t.ty ?? 0)})`);
  if (t.rotateDeg) parts.push(`rotate(${esc(t.rotateDeg)})`);
  if (t.scale != null && t.scale !== 1) parts.push(`scale(${esc(t.scale)})`);
  return parts.length ? ` transform="${parts.join(' ')}"` : '';
}

function tuftSvg(x: number, y: number, scale: number, rot?: number, simple?: boolean): string {
  const balls = simple ? TUFT_SIMPLE_BALLS : TUFT_BALLS;
  const light = simple ? TUFT_SIMPLE_GRAINS_LIGHT : TUFT_GRAINS_LIGHT;
  const dark = simple ? TUFT_SIMPLE_GRAINS_DARK : TUFT_GRAINS_DARK;
  let out = `<g transform="translate(${esc(x)},${esc(y)}) scale(${esc(scale)})${rot ? ` rotate(${esc(rot)})` : ''}">`;
  for (const [cx, cy, rx, ry, paint] of balls) {
    out += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#p-${paint})"/>`;
  }
  out += `<g fill="${C.mossGrainLight}" opacity=".85">`;
  for (const [cx, cy, r] of light) out += `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
  out += `</g><g fill="${C.mossGrainDark}" opacity=".5">`;
  for (const [cx, cy, r] of dark) out += `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
  out += '</g></g>';
  return out;
}

function primSvg(p: Prim): string {
  const op = p.opacity != null ? ` opacity="${esc(p.opacity)}"` : '';
  const blur = p.blur != null ? ` filter="url(#blur-${p.blur})"` : '';
  switch (p.kind) {
    case 'rect': {
      const rot = p.rotate ? ` transform="rotate(${esc(p.rotate.deg)} ${esc(p.rotate.cx)} ${esc(p.rotate.cy)})"` : '';
      return `<rect x="${esc(p.x)}" y="${esc(p.y)}" width="${esc(p.w)}" height="${esc(p.h)}"${p.rx ? ` rx="${esc(p.rx)}"` : ''} ${fillAttr(p.paint)}${rot}${op}${blur}/>`;
    }
    case 'ellipse': {
      const rot = p.rotateDeg ? ` transform="rotate(${esc(p.rotateDeg)} ${esc(p.cx)} ${esc(p.cy)})"` : '';
      return `<ellipse cx="${esc(p.cx)}" cy="${esc(p.cy)}" rx="${esc(p.rx)}" ry="${esc(p.ry)}" ${fillAttr(p.paint)}${rot}${op}${blur}/>`;
    }
    case 'circle':
      return `<circle cx="${esc(p.cx)}" cy="${esc(p.cy)}" r="${esc(p.r)}" ${fillAttr(p.paint)}${op}${blur}/>`;
    case 'path': {
      let stroke = '';
      if (p.stroke) {
        stroke = ` stroke="${p.stroke.color}" stroke-width="${p.stroke.width}" stroke-linecap="round"`;
        if (p.stroke.dash) stroke += ` stroke-dasharray="${p.stroke.dash[0]} ${p.stroke.dash[1]}"`;
        if (p.stroke.opacity != null) stroke += ` stroke-opacity="${esc(p.stroke.opacity)}"`;
      }
      return `<path d="${p.d}" ${fillAttr(p.paint)}${stroke}${transformAttr(p.transform)}${op}${blur}/>`;
    }
    case 'polygon':
      return `<polygon points="${p.points.map(esc).join(',')}" ${fillAttr(p.paint)}${op}${blur}/>`;
    case 'tuft':
      return tuftSvg(p.x, p.y, p.scale, p.rotateDeg, p.simple);
  }
}

export type PreviewOptions = {
  /** パン位置(世界座標)。省略時は中央パネル */
  pan?: number;
  /** ビューポートの論理幅。省略時は 1200(庭モード) */
  viewWidth?: number;
};

/** シーンをビューポート1枚のSVGとして書き出す */
export function sceneToSvg(scene: Scene, opts: PreviewOptions = {}): string {
  const viewW = opts.viewWidth ?? VIEW_LOGICAL_W;
  const pan = opts.pan ?? PAN_CENTER;
  const blurs = new Set<number>();
  const wobbles = new Set<string>();
  for (const layer of scene.layers) {
    for (const g of layer.groups) {
      if (g.blur != null) blurs.add(g.blur);
      if (g.wobble) wobbles.add(g.wobble);
      for (const p of g.prims) if (p.blur != null) blurs.add(p.blur);
    }
  }

  let defs = paintDefs(scene.paints);
  for (const b of blurs) {
    defs += `<filter id="blur-${b}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${b}"/></filter>`;
  }
  for (const wname of wobbles) {
    const wp = WOBBLE_PARAMS[wname as keyof typeof WOBBLE_PARAMS];
    const pad = wname === 'cobble' ? 40 : 20;
    defs +=
      `<filter id="wobble-${wname}" x="-${pad}%" y="-${pad}%" width="${100 + pad * 2}%" height="${100 + pad * 2}%">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${wp.baseFrequency}" numOctaves="${wp.octaves}" seed="${wp.seed}" result="n"/>` +
      `<feDisplacementMap in="SourceGraphic" in2="n" scale="${wp.scale}"/></filter>`;
  }
  defs +=
    '<filter id="grain">' +
    `<feTurbulence type="fractalNoise" baseFrequency="${GRAIN.baseFrequency}" numOctaves="${GRAIN.octaves}" result="n"/>` +
    '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.3 0.3 0.3 0 0"/></filter>';

  let clipDefs = '';
  let clipN = 0;
  let body = '';
  for (const layer of scene.layers) {
    // screenX = worldX - PAN_CENTER - (pan - PAN_CENTER) * parallax
    const shift = -(PAN_CENTER + (pan - PAN_CENTER) * layer.parallax);
    body += `<g transform="translate(${esc(shift)},0)">`;
    for (const g of layer.groups) {
      const attrs =
        (g.opacity != null ? ` opacity="${esc(g.opacity)}"` : '') +
        (g.wobble ? ` filter="url(#wobble-${g.wobble})"` : g.blur != null ? ` filter="url(#blur-${g.blur})"` : '');
      let clipAttr = '';
      if (g.clip) {
        const id = `clip-${clipN++}`;
        clipDefs += `<clipPath id="${id}"><rect x="${esc(g.clip.x)}" y="${esc(g.clip.y)}" width="${esc(g.clip.w)}" height="${esc(g.clip.h)}"/></clipPath>`;
        clipAttr = ` clip-path="url(#${id})"`;
      }
      body += `<g${clipAttr}><g${attrs}>${g.prims.map(primSvg).join('')}</g></g>`;
    }
    body += '</g>';
  }
  defs += clipDefs;
  if (scene.overlay.grain) {
    body += `<rect width="${viewW}" height="${WORLD_H}" filter="url(#grain)" opacity="${GRAIN.opacity}"/>`;
  }
  if (scene.overlay.vignette) {
    body += `<rect width="${viewW}" height="${WORLD_H}" fill="url(#p-vignette)"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewW} ${WORLD_H}" width="${viewW}" height="${WORLD_H}">` +
    `<defs>${defs}</defs>${body}</svg>`
  );
}
