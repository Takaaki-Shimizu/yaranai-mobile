// 言い訳カードの描画(指示書 §5)。モック v3 の版下を Skia のオフスクリーン面に起こす。
//
// 3層に分けて焼く。完成演出(§4.2-3)が「夜色の地 → 灯り → 宣言文」の順に立ち上がる
// 2段構成で、層ごとに不透明度を動かすだけで済ませたいため:
//
//   ground … 夜の地・両端の竹(節と受け光)・灯りへ向かう石畳
//   light  … 中央の灯り(二重のラジアル)          ← 光量が先
//   text   … 宣言文(二層描き)・宣言日・預かりの一文・ワードマーク・QR・紙の粒子 ← 輪郭が後
//
// 3層を素直に重ねた絵は、1枚に描いた絵と完全に一致する(どの層も SrcOver の重ねだけで、
// 層をまたぐ合成モードを使っていないため)。書き出しは flattenCardLayers() で1枚に畳む。
//
// 背景は全ユーザー共通だが、宣言文の行数でしか絵は変わらないため、
// 静的アセット化(§5-7)はせず、その場で焼いている ── カードを開くのは日に何度もない。

import {
  BlurStyle,
  PaintStyle,
  Skia,
  StrokeCap,
  TileMode,
  type SkCanvas,
  type SkImage,
  type SkSurface,
} from '@shopify/react-native-skia';
import { fonts } from '@yaranai/core';

import {
  CARD_LAYOUTS, declarationBaselines,
  type CardLayout, type CardSize, type GradientStop, type Stroke, type TextSpec,
} from '../../lib/excuse/card-spec';
import { buildQrMatrix } from '../../lib/excuse/qr';

/** カードに載る文言。言語の解決は呼び出し側(画面)で済ませて渡す */
export type CardContent = {
  /** 宣言文。読点で割られた1〜2行 */
  lines: string[];
  /** 宣言日。空文字なら行ごと出さない */
  date: string;
  /** 預かりの一文。サイズごとの行組みで渡す */
  custody: string[];
  wordmark: string;
  qrLabel: string;
  /** QRに載せるURL */
  url: string;
};

export type CardLayers = { ground: SkImage; light: SkImage; text: SkImage };

const FONT_FAMILY = fonts.serif ?? 'serif';

// 明朝の漢字・かなは、ベースラインの上 0.36em あたりに視覚的な重心が来る。
// Skia の Paragraph は行の上端しか渡してくれず、行の高さは実際に選ばれた
// フォント(端末ごとに違う)の上下メトリクスで決まる。そこで版下のベースラインを
// 「この光学的中心」に読み替え、行箱の中心をそこへ合わせる。
// 端末のフォントが変わっても字が上下に泳がない。
const OPTICAL_CENTER_RATIO = 0.36;

const rgba = (hex: string, opacity: number) => {
  const v = parseInt(hex.slice(1), 16);
  return Skia.Color(`rgba(${(v >> 16) & 0xff},${(v >> 8) & 0xff},${v & 0xff},${opacity})`);
};

/**
 * オフスクリーン面のスナップショットはGPUテクスチャのままだと画面のCanvasから
 * 参照できないことがあるため、CPU側の画像に複製して返す(garden/renderer.ts と同じ)。
 */
function snapshotRaster(surface: SkSurface): SkImage {
  surface.flush();
  const texture = surface.makeImageSnapshot();
  const image = texture.makeNonTextureImage();
  texture.dispose();
  surface.dispose();
  return image;
}

function makeSurface(width: number, height: number): SkSurface | null {
  return Skia.Surface.MakeOffscreen(width, height) ?? Skia.Surface.Make(width, height);
}

function linearShader(stops: GradientStop[], x: number, y: number, w: number, h: number) {
  return Skia.Shader.MakeLinearGradient(
    { x, y },
    { x, y: y + h },
    stops.map((s) => rgba(s.color, s.opacity ?? 1)),
    stops.map((s) => s.offset),
    TileMode.Clamp,
  );
}

/** SVG の objectBoundingBox 基準の radial と等価(単位空間の円を版面へ引き伸ばす) */
function radialShader(
  center: readonly [number, number], radius: number, stops: GradientStop[],
  width: number, height: number,
) {
  const m = Skia.Matrix();
  m.scale(width, height);
  return Skia.Shader.MakeRadialGradient(
    { x: center[0], y: center[1] }, radius,
    stops.map((s) => rgba(s.color, s.opacity ?? 1)),
    stops.map((s) => s.offset),
    TileMode.Clamp, m,
  );
}

function strokePaint(s: Stroke, blur?: number) {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(s.w);
  p.setStrokeCap(StrokeCap.Butt);
  p.setColor(rgba(s.color, s.opacity));
  if (blur != null) p.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, blur, true));
  return p;
}

type Line = { paint: (canvas: SkCanvas, left: number, top: number) => void; width: number; height: number };

/**
 * 1行を組む。字送り(letterSpacing)は最後の1字のうしろにも入るので、
 * 中央寄せの計算では幅から1字ぶん引く。
 * Paragraph を通すのは、明朝の日本語がフォントのフォールバックを要るため
 * (単一 Typeface の drawText では、Latin だけの serif に当たると豆腐になる)。
 */
function buildLine(text: string, size: number, letterSpacing: number, color: string, opacity: number): Line | null {
  try {
    const builder = Skia.ParagraphBuilder.Make();
    builder.pushStyle({
      color: rgba(color, opacity),
      fontFamilies: [FONT_FAMILY],
      fontSize: size,
      letterSpacing,
    });
    builder.addText(text);
    const paragraph = builder.build();
    paragraph.layout(Math.max(4096, size * ([...text].length + 2) * 2));
    return {
      paint: (canvas, left, top) => paragraph.paint(canvas, left, top),
      width: Math.max(0, paragraph.getLongestLine() - letterSpacing),
      height: paragraph.getHeight(),
    };
  } catch {
    return null;
  }
}

/** 版下のベースラインへ中央寄せで据える */
function drawCenteredLine(
  canvas: SkCanvas, line: Line, cx: number, baselineY: number, size: number,
): void {
  const opticalCenter = baselineY - size * OPTICAL_CENTER_RATIO;
  line.paint(canvas, cx - line.width / 2, opticalCenter - line.height / 2);
}

function drawText(canvas: SkCanvas, spec: TextSpec, text: string): void {
  if (text === '') return;
  const line = buildLine(text, spec.size, spec.letterSpacing, spec.color, spec.opacity ?? 1);
  if (line) drawCenteredLine(canvas, line, spec.cx, spec.y, spec.size);
}

// ------------------------------------------------------------
// ground: 夜の地・竹・石畳
// ------------------------------------------------------------
function drawGround(canvas: SkCanvas, L: CardLayout): void {
  const night = Skia.Paint();
  night.setShader(linearShader(L.night, 0, 0, L.width, L.height));
  canvas.drawRect({ x: 0, y: 0, width: L.width, height: L.height }, night);

  // 竹林はひと固まりでぼかす(SVG の filter を group にかけているのと同じ)
  const blurLayer = Skia.Paint();
  blurLayer.setImageFilter(Skia.ImageFilter.MakeBlur(L.bamboo.blur, L.bamboo.blur, TileMode.Decal, null));
  canvas.saveLayer(blurLayer);
  for (const culm of L.bamboo.culms) {
    const p = Skia.Paint();
    p.setAntiAlias(true);
    p.setColor(rgba(culm.color, culm.opacity ?? 1));
    canvas.drawRRect(
      { rect: { x: culm.x, y: culm.y, width: culm.w, height: culm.h }, rx: culm.r, ry: culm.r },
      p,
    );
  }
  for (const s of [...L.bamboo.nodes, ...L.bamboo.rims]) {
    canvas.drawLine(s.x1, s.y1, s.x2, s.y2, strokePaint(s));
  }
  canvas.restore();

  // 灯りへ向かう石畳。敷石の目地だけ淡く引く
  const pathLayer = Skia.Paint();
  pathLayer.setImageFilter(Skia.ImageFilter.MakeBlur(L.path.blur, L.path.blur, TileMode.Decal, null));
  canvas.saveLayer(pathLayer);
  const poly = Skia.Path.Make();
  poly.moveTo(L.path.polygon[0], L.path.polygon[1]);
  for (let i = 2; i < L.path.polygon.length; i += 2) poly.lineTo(L.path.polygon[i], L.path.polygon[i + 1]);
  poly.close();
  const bounds = poly.getBounds();
  const polyPaint = Skia.Paint();
  polyPaint.setAntiAlias(true);
  polyPaint.setShader(linearShader(L.path.stops, bounds.x, bounds.y, bounds.width, bounds.height));
  canvas.drawPath(poly, polyPaint);
  for (const s of L.path.joints) {
    canvas.drawLine(s.x1, s.y1, s.x2, s.y2, strokePaint(s));
  }
  canvas.restore();
}

// ------------------------------------------------------------
// light: 中央の灯り(二重)
// ------------------------------------------------------------
function drawLight(canvas: SkCanvas, L: CardLayout): void {
  const rect = { x: 0, y: 0, width: L.width, height: L.height };
  for (const g of [L.glow, L.glowCore]) {
    const p = Skia.Paint();
    p.setShader(radialShader(g.center, g.radius, g.stops, L.width, L.height));
    canvas.drawRect(rect, p);
  }
}

// ------------------------------------------------------------
// text: 宣言文(二層描き)・宣言日・預かり・ワードマーク・QR・粒子
// ------------------------------------------------------------
function drawDeclaration(canvas: SkCanvas, L: CardLayout, lines: string[]): void {
  const d = L.declaration;
  const baselines = declarationBaselines(L, lines.length);

  // まず版下の字送りで測り、安全幅を超えるぶんだけ字ごと縮める(§9-2 はみ出し禁止の保険)。
  // 縮尺は全行に同じものを掛ける ── 行ごとに大きさが変わると掛け軸に見えない。
  const measured = lines.map((text) => buildLine(text, d.size, d.letterSpacing, d.color, 1));
  const widest = measured.reduce((max, line) => Math.max(max, line?.width ?? 0), 0);
  const scale = widest > d.safeWidth ? d.safeWidth / widest : 1;
  const size = d.size * scale;
  const letterSpacing = d.letterSpacing * scale;

  // 下layer: ぼかした光量の層(LP題字と同じ「光量が先、輪郭が後」の静止画版)。
  // SVG は blur を2枚重ねてから group opacity を掛けているので、同じ順で組む。
  const glowLayer = Skia.Paint();
  glowLayer.setAlphaf(d.glowOpacity);
  canvas.saveLayer(glowLayer);
  const blurLayer = Skia.Paint();
  blurLayer.setImageFilter(Skia.ImageFilter.MakeBlur(d.glowBlur, d.glowBlur, TileMode.Decal, null));
  canvas.saveLayer(blurLayer);
  lines.forEach((text, i) => {
    const line = buildLine(text, size, letterSpacing, d.glowColor, 1);
    if (!line) return;
    drawCenteredLine(canvas, line, d.cx, baselines[i], size);
    drawCenteredLine(canvas, line, d.cx, baselines[i], size);
  });
  canvas.restore();
  canvas.restore();

  // 上layer: 輪郭の層
  lines.forEach((text, i) => {
    const line = buildLine(text, size, letterSpacing, d.color, 1);
    if (line) drawCenteredLine(canvas, line, d.cx, baselines[i], size);
  });
}

function drawGrain(canvas: SkCanvas, L: CardLayout): void {
  const g = L.grain;
  const paint = Skia.Paint();
  paint.setShader(Skia.Shader.MakeFractalNoise(g.baseFrequency, g.baseFrequency, g.octaves, 0, 0, 0));
  // ノイズの輝度ではなく、暖色一色をノイズのアルファで置く(モックの feColorMatrix と同値)
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix([
    0, 0, 0, 0, g.rgb[0],
    0, 0, 0, 0, g.rgb[1],
    0, 0, 0, 0, g.rgb[2],
    0, 0, 0, g.alpha, 0,
  ]));
  paint.setAlphaf(g.opacity);
  canvas.drawRect({ x: 0, y: 0, width: L.width, height: L.height }, paint);
}

function drawTextLayer(canvas: SkCanvas, L: CardLayout, content: CardContent): void {
  drawDeclaration(canvas, L, content.lines.slice(0, 2));
  drawText(canvas, L.date, content.date);

  const custody = L.custody;
  content.custody.slice(0, custody.baselines.length).forEach((text, i) => {
    drawText(
      canvas,
      {
        cx: custody.cx, y: custody.baselines[i], size: custody.size,
        letterSpacing: custody.letterSpacing, color: custody.color, opacity: custody.opacity,
      },
      text,
    );
  });

  drawText(canvas, L.wordmark, content.wordmark);
  drawQrWithLabel(canvas, L, content);
  drawGrain(canvas, L);
}

/** QR本体と「Yaranaiとは」。ラベルは面の実寸に合わせて中央へ置く */
function drawQrWithLabel(canvas: SkCanvas, L: CardLayout, content: CardContent): void {
  const q = L.qr;
  const matrix = buildQrMatrix(content.url);
  const across = matrix.length + q.quietModules * 2;
  const module = Math.max(1, Math.round(q.size / across));
  const panel = module * across;

  const panelPaint = Skia.Paint();
  panelPaint.setAntiAlias(true);
  panelPaint.setColor(rgba(q.panelColor, q.panelOpacity));
  canvas.drawRRect({ rect: { x: q.x, y: q.y, width: panel, height: panel }, rx: 2, ry: 2 }, panelPaint);

  const modulePaint = Skia.Paint();
  modulePaint.setAntiAlias(false);
  modulePaint.setColor(rgba(q.moduleColor, q.moduleOpacity));
  const originX = q.x + q.quietModules * module;
  const originY = q.y + q.quietModules * module;
  matrix.forEach((row, r) => {
    row.forEach((dark, c) => {
      if (!dark) return;
      canvas.drawRect(
        { x: originX + c * module, y: originY + r * module, width: module, height: module },
        modulePaint,
      );
    });
  });

  drawText(canvas, { ...q.label, cx: q.x + panel / 2 }, content.qrLabel);
}

/**
 * 3層を焼く。ひとつでも焼けんかったら null(呼び出し側は静かに出さない)。
 *
 * scale は版下(1080幅)に対する実ピクセルの倍率。書き出しは 1(=1080px)、
 * 画面表示は「表示幅 dp × 端末の画素密度 ÷ 1080」を渡す。1を超えて焼く意味はない。
 * 版下の座標系はそのままなので、線幅もぼかしも字送りもこの1掛けで揃って縮む。
 */
export function bakeCardLayers(
  size: CardSize, content: CardContent, scale = 1,
): CardLayers | null {
  const L = CARD_LAYOUTS[size];
  const width = Math.max(1, Math.round(L.width * scale));
  const height = Math.max(1, Math.round(L.height * scale));
  const surfaces = {
    ground: makeSurface(width, height),
    light: makeSurface(width, height),
    text: makeSurface(width, height),
  };
  if (!surfaces.ground || !surfaces.light || !surfaces.text) {
    surfaces.ground?.dispose();
    surfaces.light?.dispose();
    surfaces.text?.dispose();
    return null;
  }
  const scaled = (surface: SkSurface, draw: (canvas: SkCanvas) => void) => {
    const canvas = surface.getCanvas();
    canvas.save();
    canvas.scale(scale, scale);
    draw(canvas);
    canvas.restore();
  };
  scaled(surfaces.ground, (canvas) => drawGround(canvas, L));
  scaled(surfaces.light, (canvas) => drawLight(canvas, L));
  scaled(surfaces.text, (canvas) => drawTextLayer(canvas, L, content));
  return {
    ground: snapshotRaster(surfaces.ground),
    light: snapshotRaster(surfaces.light),
    text: snapshotRaster(surfaces.text),
  };
}

/** 3層を1枚へ畳む。書き出し(PNG)に使う */
export function flattenCardLayers(layers: CardLayers): SkImage | null {
  const surface = makeSurface(layers.ground.width(), layers.ground.height());
  if (!surface) return null;
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  canvas.drawImage(layers.ground, 0, 0, paint);
  canvas.drawImage(layers.light, 0, 0, paint);
  canvas.drawImage(layers.text, 0, 0, paint);
  return snapshotRaster(surface);
}

/** 書き出し用の一枚(版下と同寸の 1080px)。層は使い捨てる */
export function bakeCardImage(size: CardSize, content: CardContent): SkImage | null {
  const layers = bakeCardLayers(size, content, 1);
  if (!layers) return null;
  const flat = flattenCardLayers(layers);
  layers.ground.dispose();
  layers.light.dispose();
  layers.text.dispose();
  return flat;
}
