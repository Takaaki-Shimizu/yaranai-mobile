// 起動演出「小径」のベイク(§2.4)。
// 竹林コンポジション(lib/launch/komichi)を起動時に一度だけオフスクリーンで描き、
// SkImage に焼き固める。演出中の毎フレームは「画像1枚+光3つ+文字」だけになり、
// ミドルレンジ端末でもカクつかない(§8-9)。

import {
  Skia,
  StrokeCap,
  PaintStyle,
  TileMode,
  type SkCanvas,
  type SkImage,
  type SkSurface,
} from '@shopify/react-native-skia';

import {
  buildKomichiScene, coverTransform,
  KOMICHI_GRAIN, KOMICHI_SKY, KOMICHI_VIGNETTE,
  SCENE_H, SCENE_W,
  type KomichiPrim, type StalkLayer,
} from '../../lib/launch/komichi';

const rgba = (hex: string, op: number) => {
  const v = parseInt(hex.slice(1), 16);
  return Skia.Color(`rgba(${(v >> 16) & 0xff},${(v >> 8) & 0xff},${v & 0xff},${op})`);
};

// オフスクリーン面のスナップショットはGPUテクスチャのままだと画面のCanvasから
// 参照できないことがあるため、CPU側の画像に複製して返す(garden/renderer.ts と同じ)。
function snapshotRaster(surface: SkSurface): SkImage {
  surface.flush();
  const texture = surface.makeImageSnapshot();
  const image = texture.makeNonTextureImage();
  texture.dispose();
  surface.dispose();
  return image;
}

function fill(color: string, opacity = 1) {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  if (opacity < 1) p.setAlphaf(opacity);
  return p;
}

function drawPrim(canvas: SkCanvas, prim: KomichiPrim): void {
  switch (prim.kind) {
    case 'rect':
      canvas.drawRect({ x: prim.x, y: prim.y, width: prim.w, height: prim.h }, fill(prim.color, prim.opacity ?? 1));
      break;
    case 'poly': {
      const path = Skia.Path.Make();
      path.moveTo(prim.pts[0], prim.pts[1]);
      for (let i = 2; i < prim.pts.length; i += 2) path.lineTo(prim.pts[i], prim.pts[i + 1]);
      path.close();
      canvas.drawPath(path, fill(prim.color, prim.opacity ?? 1));
      break;
    }
    case 'line': {
      const p = Skia.Paint();
      p.setAntiAlias(true);
      p.setStyle(PaintStyle.Stroke);
      p.setStrokeWidth(prim.width);
      if (prim.round) p.setStrokeCap(StrokeCap.Round);
      p.setColor(Skia.Color(prim.color));
      if (prim.opacity != null && prim.opacity < 1) p.setAlphaf(prim.opacity);
      canvas.drawLine(prim.x1, prim.y1, prim.x2, prim.y2, p);
      break;
    }
    case 'circle':
      canvas.drawCircle(prim.cx, prim.cy, prim.r, fill(prim.color, prim.opacity));
      break;
    case 'ellipse': {
      canvas.save();
      canvas.rotate(prim.rotateDeg, prim.px, prim.py);
      canvas.drawOval(
        { x: prim.cx - prim.rx, y: prim.cy - prim.ry, width: prim.rx * 2, height: prim.ry * 2 },
        fill(prim.color, prim.opacity),
      );
      canvas.restore();
      break;
    }
  }
}

/** objectBoundingBox(300×640)基準の radial シェーダ(SVG と等価。renderer.ts と同じ手口) */
function sceneRadial(
  center: readonly [number, number], radius: number,
  stops: ReadonlyArray<{ offset: number; color?: string; opacity?: number }>, baseColor?: string,
) {
  const colors = stops.map((s) => rgba(s.color ?? baseColor ?? '#000000', s.opacity ?? 1));
  const pos = stops.map((s) => s.offset);
  const m = Skia.Matrix();
  m.scale(SCENE_W, SCENE_H);
  return Skia.Shader.MakeRadialGradient(
    { x: center[0], y: center[1] }, radius, colors, pos, TileMode.Clamp, m,
  );
}

/**
 * 竹林コンポジションを widthPx×heightPx の一枚に焼く。
 * 描画順: 空 → 遠層竹 → 地面(参道・土手・竹垣) → 中層竹 → 近層竹 → 葉叢 → 口径食 → 粒子。
 * 生成はシード固定なので、この画像は毎回同一(§2.4)。
 */
export function bakeKomichi(widthPx: number, heightPx: number): SkImage | null {
  const surface = Skia.Surface.MakeOffscreen(widthPx, heightPx) ?? Skia.Surface.Make(widthPx, heightPx);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  const scene = buildKomichiScene();
  const { s, ox, oy } = coverTransform(widthPx, heightPx);

  canvas.save();
  canvas.translate(ox, oy);
  canvas.scale(s, s);

  // 空(靄は開口部から広がる明るいグラデとして空に含まれる)
  const sky = Skia.Paint();
  sky.setShader(sceneRadial(KOMICHI_SKY.center, KOMICHI_SKY.radius, KOMICHI_SKY.stops));
  canvas.drawRect({ x: 0, y: 0, width: SCENE_W, height: SCENE_H }, sky);

  const byLayer = (layer: StalkLayer) => scene.stalks.filter((st) => st.layer === layer);
  for (const st of byLayer('deep')) for (const p of st.prims) drawPrim(canvas, p);
  for (const p of scene.ground) drawPrim(canvas, p);
  for (const st of byLayer('mid')) for (const p of st.prims) drawPrim(canvas, p);
  for (const st of byLayer('near')) for (const p of st.prims) drawPrim(canvas, p);
  for (const p of scene.canopy) drawPrim(canvas, p);

  // 口径食(四隅の沈み)
  const vig = Skia.Paint();
  vig.setShader(sceneRadial(
    KOMICHI_VIGNETTE.center, KOMICHI_VIGNETTE.radius, KOMICHI_VIGNETTE.stops, KOMICHI_VIGNETTE.color,
  ));
  canvas.drawRect({ x: 0, y: 0, width: SCENE_W, height: SCENE_H }, vig);
  canvas.restore();

  // 和紙の粒子(画素基準のノイズ。輝度→アルファの墨色粒。mockP grainP 相当)
  const grain = Skia.Paint();
  grain.setShader(Skia.Shader.MakeFractalNoise(
    KOMICHI_GRAIN.baseFrequency, KOMICHI_GRAIN.baseFrequency, KOMICHI_GRAIN.octaves, 0, 0, 0,
  ));
  grain.setColorFilter(Skia.ColorFilter.MakeMatrix([
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0.55, 0.55, 0.55, 0, 0,
  ]));
  grain.setAlphaf(KOMICHI_GRAIN.opacity);
  canvas.drawRect({ x: 0, y: 0, width: widthPx, height: heightPx }, grain);

  return snapshotRaster(surface);
}

export type BakedGlow = { image: SkImage; width: number; height: number };

/**
 * 題字グローの下層(ぼかしの発光層)を一枚に焼く(§3 の2層方式)。
 * 上層のシャープな文字は RN Text(ヘッダーと同一フォント)なので、下層だけ
 * Skia Paragraph で同寸に組んで大きくぼかす。失敗したら null(グローなしで進行)。
 */
export function bakeTitleGlow(opts: {
  text: string;
  fontFamily: string;
  fontSizePx: number;
  letterSpacingPx: number;
  blurPx: number;
}): BakedGlow | null {
  try {
    const builder = Skia.ParagraphBuilder.Make();
    builder.pushStyle({
      color: Skia.Color('#f6f4e0'),
      fontFamilies: [opts.fontFamily],
      fontSize: opts.fontSizePx,
      letterSpacing: opts.letterSpacingPx,
    });
    builder.addText(opts.text);
    const paragraph = builder.build();
    paragraph.layout(opts.fontSizePx * (opts.text.length + 2) * 2);
    const textW = Math.ceil(paragraph.getLongestLine());
    const textH = Math.ceil(paragraph.getHeight());
    if (textW <= 0 || textH <= 0) return null;
    const pad = Math.ceil(opts.blurPx * 3);
    const width = textW + pad * 2;
    const height = textH + pad * 2;
    const surface = Skia.Surface.MakeOffscreen(width, height) ?? Skia.Surface.Make(width, height);
    if (!surface) return null;
    const canvas = surface.getCanvas();
    const layerPaint = Skia.Paint();
    layerPaint.setImageFilter(Skia.ImageFilter.MakeBlur(opts.blurPx, opts.blurPx, TileMode.Decal, null));
    canvas.saveLayer(layerPaint);
    paragraph.paint(canvas, pad, pad);
    canvas.restore();
    return { image: snapshotRaster(surface), width, height };
  } catch {
    // グローは装飾の下層。組めない環境では上層(RN Text)だけで成立させる
    return null;
  }
}
