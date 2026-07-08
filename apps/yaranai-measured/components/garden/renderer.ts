// シーンスペック → Skia 描画(命令的)。
// 揺らぎ(DisplacementMap+FractalNoise)と、ぼかしはベイク時に一度だけ評価し、
// レイヤーごとに SkImage 化する。パン中は画像の平行移動だけなので
// ミドルレンジ端末でも 60fps を狙える(§6 の「起動時ベイク」方式)。

import {
  BlurStyle,
  ClipOp,
  ColorChannel,
  PaintStyle,
  Skia,
  StrokeCap,
  TileMode,
  type SkCanvas,
  type SkImage,
  type SkPaint,
  type SkShader,
  type SkSurface,
} from '@shopify/react-native-skia';

import {
  PAN_CENTER, VIEW_LOGICAL_W, WORLD_H, WORLD_W,
  TUFT_BALLS, TUFT_GRAINS_DARK, TUFT_GRAINS_LIGHT,
  TUFT_SIMPLE_BALLS, TUFT_SIMPLE_GRAINS_DARK, TUFT_SIMPLE_GRAINS_LIGHT,
} from '../../lib/garden/scene';
import { GARDEN_COLORS as C, GRAIN, WOBBLE_PARAMS } from '../../lib/garden/tokens';
import type { Paint, Prim, Scene, SceneGroup, SceneLayer } from '../../lib/garden/scene-types';

type Box = { x: number; y: number; w: number; h: number };

const colorWithOpacity = (hex: string, op: number) => {
  const v = parseInt(hex.slice(1), 16);
  return Skia.Color(`rgba(${(v >> 16) & 0xff},${(v >> 8) & 0xff},${v & 0xff},${op})`);
};

function resolvePaint(spec: Paint, scene: Scene): Exclude<Paint, { type: 'ref' }> {
  return spec.type === 'ref'
    ? (scene.paints[spec.name] as Exclude<Paint, { type: 'ref' }>)
    : spec;
}

function makeShader(spec: Exclude<Paint, { type: 'ref' | 'solid' }>, box: Box): SkShader {
  const colors = spec.stops.map((s) => colorWithOpacity(s.color, s.opacity ?? 1));
  const pos = spec.stops.map((s) => s.offset);
  if (spec.type === 'linear') {
    return Skia.Shader.MakeLinearGradient(
      { x: box.x + spec.from[0] * box.w, y: box.y + spec.from[1] * box.h },
      { x: box.x + spec.to[0] * box.w, y: box.y + spec.to[1] * box.h },
      colors, pos, TileMode.Clamp,
    );
  }
  // SVG objectBoundingBox の radial と等価: 単位空間の円をバウンディングボックスへ引き伸ばす
  const m = Skia.Matrix();
  m.translate(box.x, box.y);
  m.scale(box.w, box.h);
  return Skia.Shader.MakeRadialGradient(
    { x: spec.center[0], y: spec.center[1] }, spec.radius,
    colors, pos, TileMode.Clamp, m,
  );
}

function fillPaint(spec: Paint | undefined, scene: Scene, box: Box, opacity: number, blur?: number): SkPaint {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  if (spec) {
    const resolved = resolvePaint(spec, scene);
    if (resolved.type === 'solid') paint.setColor(Skia.Color(resolved.color));
    else paint.setShader(makeShader(resolved, box));
  }
  if (opacity < 1) paint.setAlphaf(opacity);
  if (blur != null) paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, blur, true));
  return paint;
}

function drawTuft(
  canvas: SkCanvas, scene: Scene,
  x: number, y: number, scale: number, rot: number | undefined, simple: boolean | undefined,
  groupOpacity: number,
): void {
  const balls = simple ? TUFT_SIMPLE_BALLS : TUFT_BALLS;
  const light = simple ? TUFT_SIMPLE_GRAINS_LIGHT : TUFT_GRAINS_LIGHT;
  const dark = simple ? TUFT_SIMPLE_GRAINS_DARK : TUFT_GRAINS_DARK;
  canvas.save();
  canvas.translate(x, y);
  canvas.scale(scale, scale);
  if (rot) canvas.rotate(rot, 0, 0);
  for (const [cx, cy, rx, ry, ref] of balls) {
    const box: Box = { x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2 };
    const paint = fillPaint({ type: 'ref', name: ref }, scene, box, groupOpacity);
    canvas.drawOval({ x: box.x, y: box.y, width: box.w, height: box.h }, paint);
  }
  const lightPaint = Skia.Paint();
  lightPaint.setAntiAlias(true);
  lightPaint.setColor(Skia.Color(C.mossGrainLight));
  lightPaint.setAlphaf(0.85 * groupOpacity);
  for (const [cx, cy, r] of light) canvas.drawCircle(cx, cy, r, lightPaint);
  const darkPaint = Skia.Paint();
  darkPaint.setAntiAlias(true);
  darkPaint.setColor(Skia.Color(C.mossGrainDark));
  darkPaint.setAlphaf(0.5 * groupOpacity);
  for (const [cx, cy, r] of dark) canvas.drawCircle(cx, cy, r, darkPaint);
  canvas.restore();
}

function drawPrim(canvas: SkCanvas, scene: Scene, prim: Prim, groupOpacity: number): void {
  const op = (prim.opacity ?? 1) * groupOpacity;
  switch (prim.kind) {
    case 'rect': {
      const box: Box = { x: prim.x, y: prim.y, w: prim.w, h: prim.h };
      const paint = fillPaint(prim.paint, scene, box, op, prim.blur);
      if (prim.rotate) {
        canvas.save();
        canvas.rotate(prim.rotate.deg, prim.rotate.cx, prim.rotate.cy);
      }
      const rect = { x: prim.x, y: prim.y, width: prim.w, height: prim.h };
      if (prim.rx) canvas.drawRRect({ rect, rx: prim.rx, ry: prim.rx }, paint);
      else canvas.drawRect(rect, paint);
      if (prim.rotate) canvas.restore();
      break;
    }
    case 'ellipse': {
      const box: Box = { x: prim.cx - prim.rx, y: prim.cy - prim.ry, w: prim.rx * 2, h: prim.ry * 2 };
      const paint = fillPaint(prim.paint, scene, box, op, prim.blur);
      if (prim.rotateDeg) {
        canvas.save();
        canvas.rotate(prim.rotateDeg, prim.cx, prim.cy);
      }
      canvas.drawOval({ x: box.x, y: box.y, width: box.w, height: box.h }, paint);
      if (prim.rotateDeg) canvas.restore();
      break;
    }
    case 'circle': {
      const box: Box = { x: prim.cx - prim.r, y: prim.cy - prim.r, w: prim.r * 2, h: prim.r * 2 };
      canvas.drawCircle(prim.cx, prim.cy, prim.r, fillPaint(prim.paint, scene, box, op, prim.blur));
      break;
    }
    case 'path': {
      const path = Skia.Path.MakeFromSVGString(prim.d);
      if (!path) return;
      const t = prim.transform;
      canvas.save();
      if (t) {
        canvas.translate(t.tx ?? 0, t.ty ?? 0);
        if (t.rotateDeg) canvas.rotate(t.rotateDeg, 0, 0);
        if (t.scale != null && t.scale !== 1) canvas.scale(t.scale, t.scale);
      }
      const b = path.getBounds();
      const box: Box = { x: b.x, y: b.y, w: b.width, h: b.height };
      if (prim.paint) {
        canvas.drawPath(path, fillPaint(prim.paint, scene, box, op, prim.blur));
      }
      if (prim.stroke) {
        const sp = Skia.Paint();
        sp.setAntiAlias(true);
        sp.setStyle(PaintStyle.Stroke);
        sp.setStrokeWidth(prim.stroke.width);
        sp.setStrokeCap(StrokeCap.Round);
        sp.setColor(Skia.Color(prim.stroke.color));
        sp.setAlphaf((prim.stroke.opacity ?? 1) * op);
        if (prim.stroke.dash) {
          sp.setPathEffect(Skia.PathEffect.MakeDash([prim.stroke.dash[0], prim.stroke.dash[1]], 0));
        }
        canvas.drawPath(path, sp);
      }
      canvas.restore();
      break;
    }
    case 'polygon': {
      const path = Skia.Path.Make();
      path.moveTo(prim.points[0], prim.points[1]);
      for (let i = 2; i < prim.points.length; i += 2) path.lineTo(prim.points[i], prim.points[i + 1]);
      path.close();
      const b = path.getBounds();
      const box: Box = { x: b.x, y: b.y, w: b.width, h: b.height };
      canvas.drawPath(path, fillPaint(prim.paint, scene, box, op, prim.blur));
      break;
    }
    case 'tuft':
      drawTuft(canvas, scene, prim.x, prim.y, prim.scale, prim.rotateDeg, prim.simple, op);
      break;
  }
}

function drawGroup(canvas: SkCanvas, scene: Scene, group: SceneGroup): void {
  if (group.clip) {
    canvas.save();
    canvas.clipRect(
      { x: group.clip.x, y: group.clip.y, width: group.clip.w, height: group.clip.h },
      ClipOp.Intersect, true,
    );
    drawGroupInner(canvas, scene, group);
    canvas.restore();
    return;
  }
  drawGroupInner(canvas, scene, group);
}

function drawGroupInner(canvas: SkCanvas, scene: Scene, group: SceneGroup): void {
  const needsLayer = group.wobble != null || group.blur != null;
  if (needsLayer) {
    const layerPaint = Skia.Paint();
    if (group.wobble) {
      const wp = WOBBLE_PARAMS[group.wobble];
      const noise = Skia.Shader.MakeFractalNoise(wp.baseFrequency, wp.baseFrequency, wp.octaves, wp.seed, 0, 0);
      layerPaint.setImageFilter(
        Skia.ImageFilter.MakeDisplacementMap(
          ColorChannel.A, ColorChannel.A, wp.scale,
          Skia.ImageFilter.MakeShader(noise), null,
        ),
      );
    } else if (group.blur != null) {
      layerPaint.setImageFilter(Skia.ImageFilter.MakeBlur(group.blur, group.blur, TileMode.Decal, null));
    }
    if (group.opacity != null) layerPaint.setAlphaf(group.opacity);
    canvas.saveLayer(layerPaint);
    for (const prim of group.prims) drawPrim(canvas, scene, prim, 1);
    canvas.restore();
  } else {
    for (const prim of group.prims) drawPrim(canvas, scene, prim, group.opacity ?? 1);
  }
}

/** ビューポート固定の紙の質感(粒子+ビネット)を描く。座標はpx */
export function drawOverlay(canvas: SkCanvas, scene: Scene, widthPx: number, heightPx: number): void {
  if (scene.overlay.grain) {
    const paint = Skia.Paint();
    paint.setShader(Skia.Shader.MakeFractalNoise(GRAIN.baseFrequency, GRAIN.baseFrequency, GRAIN.octaves, 0, 0, 0));
    // SVG の feColorMatrix と同じ: 輝度をアルファへ、RGBは黒
    paint.setColorFilter(Skia.ColorFilter.MakeMatrix([
      0, 0, 0, 0, 0,
      0, 0, 0, 0, 0,
      0, 0, 0, 0, 0,
      0.3, 0.3, 0.3, 0, 0,
    ]));
    paint.setAlphaf(GRAIN.opacity);
    canvas.drawRect({ x: 0, y: 0, width: widthPx, height: heightPx }, paint);
  }
  if (scene.overlay.vignette) {
    const box: Box = { x: 0, y: 0, w: widthPx, h: heightPx };
    canvas.drawRect(
      { x: 0, y: 0, width: widthPx, height: heightPx },
      fillPaint({ type: 'ref', name: 'vignette' }, scene, box, 1),
    );
  }
}

// オフスクリーン面のスナップショットは生成元のGPUコンテキストに紐づくテクスチャで、
// 画面の Canvas(別スレッドの描画コンテキスト)からは参照できず何も映らない。
// makeNonTextureImage() でCPU側の画像に複製してから返す。
function snapshotRaster(surface: SkSurface): SkImage {
  surface.flush();
  const texture = surface.makeImageSnapshot();
  const image = texture.makeNonTextureImage();
  texture.dispose();
  surface.dispose();
  return image;
}

/** 紙の質感をビューポートサイズの一枚に焼く(パン中は載せるだけ) */
export function bakeOverlay(scene: Scene, widthPx: number, heightPx: number): SkImage | null {
  const surface = Skia.Surface.MakeOffscreen(widthPx, heightPx) ?? Skia.Surface.Make(widthPx, heightPx);
  if (!surface) return null;
  drawOverlay(surface.getCanvas(), scene, widthPx, heightPx);
  return snapshotRaster(surface);
}

export type BakedLayer = {
  id: string;
  parallax: number;
  image: SkImage;
  /** 画像左上のレイヤー空間X(論理座標) */
  originX: number;
  /** ベイク解像度(論理→px) */
  scale: number;
};

/**
 * レイヤーごとの表示必要域:
 *   x ∈ [PAN_CENTER·(1−f), PAN_CENTER·(1+f) + VIEW_LOGICAL_W]
 * (screenX = worldX − PAN_CENTER − (pan − PAN_CENTER)·f, pan ∈ [0, PAN_MAX])
 */
export function layerSpan(parallax: number): { x0: number; x1: number } {
  const margin = 28; // 揺らぎ・ぼかしぶんの余白
  return {
    x0: Math.max(-margin, PAN_CENTER * (1 - parallax) - margin),
    x1: Math.min(WORLD_W + margin, PAN_CENTER * (1 + parallax) + VIEW_LOGICAL_W + margin),
  };
}

function bakeLayer(scene: Scene, layer: SceneLayer, scale: number): BakedLayer | null {
  const span = layerSpan(layer.parallax);
  const wPx = Math.ceil((span.x1 - span.x0) * scale);
  const hPx = Math.ceil(WORLD_H * scale);
  const surface = Skia.Surface.MakeOffscreen(wPx, hPx) ?? Skia.Surface.Make(wPx, hPx);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.scale(scale, scale);
  canvas.translate(-span.x0, 0);
  for (const group of layer.groups) drawGroup(canvas, scene, group);
  const image = snapshotRaster(surface);
  return { id: layer.id, parallax: layer.parallax, image, originX: span.x0, scale };
}

/** 絵巻全レイヤーを画像化する(庭モード用) */
export function bakeLayers(scene: Scene, scale: number): BakedLayer[] {
  const out: BakedLayer[] = [];
  for (const layer of scene.layers) {
    const baked = bakeLayer(scene, layer, scale);
    if (baked) out.push(baked);
  }
  return out;
}

/**
 * ホームの窓: 固定パンで全レイヤーを1枚に合成する(静止画)。
 * viewW は論理幅、pan はビューポート左端の世界座標(f=1 基準)。
 */
export function bakeComposite(
  scene: Scene,
  opts: { pan: number; viewW: number; viewHPx: number; viewWPx: number },
): SkImage | null {
  const { pan, viewW, viewWPx, viewHPx } = opts;
  const scale = viewWPx / viewW;
  const surface = Skia.Surface.MakeOffscreen(viewWPx, viewHPx) ?? Skia.Surface.Make(viewWPx, viewHPx);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  // 縦は絵(800)を窓の高さに収め、余白は空と大地の色で伸ばす(ブリード)
  const fitScale = Math.max(scale, viewHPx / WORLD_H);
  const offsetY = (viewHPx - WORLD_H * fitScale) / 2;
  // ブリード背景
  const sky = resolvePaint({ type: 'ref', name: 'sky' }, scene);
  const field = resolvePaint({ type: 'ref', name: 'field' }, scene);
  const bg = Skia.Paint();
  if (sky.type !== 'solid') bg.setColor(colorWithOpacity(sky.stops[0].color, 1));
  canvas.drawRect({ x: 0, y: 0, width: viewWPx, height: viewHPx }, bg);
  const bottom = Skia.Paint();
  if (field.type !== 'solid') bottom.setColor(colorWithOpacity(field.stops[2].color, 1));
  canvas.drawRect({ x: 0, y: viewHPx / 2, width: viewWPx, height: viewHPx / 2 }, bottom);
  canvas.save();
  canvas.translate(0, offsetY);
  canvas.scale(fitScale, fitScale);
  canvas.translate(-(PAN_CENTER + (pan - PAN_CENTER)), 0);
  for (const layer of scene.layers) {
    canvas.save();
    // 固定パンでも視差ぶんの位置合わせは必要
    canvas.translate((pan - PAN_CENTER) * (1 - layer.parallax), 0);
    for (const group of layer.groups) drawGroup(canvas, scene, group);
    canvas.restore();
  }
  canvas.restore();
  drawOverlay(canvas, scene, viewWPx, viewHPx);
  return snapshotRaster(surface);
}
