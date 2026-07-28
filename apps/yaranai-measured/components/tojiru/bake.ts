// 障子一枚を画像に焼く(指示書 §4)。閉じ際は一枚を焼いて左右に置くだけなので、
// 演出中は画像の平行移動と不透明度しか動かない(庭のベイクと同じ方式)。
//
// 品質基準(§4)をこの一枚で満たす:
//   1. 縦横の桟(縦3本 × 横6本)。寸法は lib/tojiru/shoji.ts
//   2. 和紙面に微細なノイズ質感(庭の紙の粒 GRAIN と同じ生成ノイズ系統を流用)
//   3. 透け感は焼かない。閉じ進行に応じた不透明度で TojiruCurtain が担う
//   4. 框は和紙より暗いトーン(墨)で、桟(薄墨)より太い
//
// 色はアプリの既存パレット(生成り・砂・薄墨・墨)からのみ取る。新色は入れない。

import { Skia, TileMode, type SkImage } from '@shopify/react-native-skia';
import { colors } from '@yaranai/core';

import { GRAIN, GRAIN_RGB } from '../../lib/garden/tokens';
import type { ShojiPanel } from '../../lib/tojiru/shoji';
import { snapshotRaster } from '../garden/renderer';

/** 障子の色。すべて既存パレット由来 */
export const SHOJI_COLORS = {
  /** 和紙面: 生成り → 砂へごくわずかに落とす(裾の方が影になる) */
  washiTop: colors.kinari,
  washiBottom: colors.suna,
  /** 桟(格子): 薄墨 */
  mullion: colors.usuzumi,
  /** 框(外枠): 墨。和紙より暗く、桟より太い */
  stile: colors.sumi,
} as const;

/**
 * 和紙の粒。庭の紙の粒(GRAIN.opacity = 0.035)は木漏れ日の載った面に対する値で、
 * 平らな和紙の上ではほとんど見えん。質感が判る下限まで少しだけ上げる。
 */
const WASHI_GRAIN_OPACITY = 0.06;

/** 框の内側に落ちる影。和紙が枠より奥にあることを、線一本ぶんの暗さで示す */
const STILE_INNER_SHADOW_OPACITY = 0.1;

const hexToRgb = (hex: string) => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff] as const;
};

const rgba = (hex: string, alpha: number) => {
  const [r, g, b] = hexToRgb(hex);
  return Skia.Color(`rgba(${r},${g},${b},${alpha})`);
};

/**
 * 障子一枚(左側の一枚)を焼く。右の一枚は同じ画像を左右反転して置く。
 * 乱数も日付も使わんので、何度焼いても同じ絵になる(§7-6)。
 */
export function bakeShojiPanel(panel: ShojiPanel, density: number): SkImage | null {
  const wPx = Math.max(1, Math.round(panel.width * density));
  const hPx = Math.max(1, Math.round(panel.height * density));
  const surface = Skia.Surface.MakeOffscreen(wPx, hPx) ?? Skia.Surface.Make(wPx, hPx);
  if (!surface) return null;
  const canvas = surface.getCanvas();

  canvas.save();
  canvas.scale(density, density);

  // 和紙面(縦のごく浅いグラデ)
  const washi = Skia.Paint();
  washi.setShader(
    Skia.Shader.MakeLinearGradient(
      { x: 0, y: 0 },
      { x: 0, y: panel.height },
      [Skia.Color(SHOJI_COLORS.washiTop), Skia.Color(SHOJI_COLORS.washiBottom)],
      [0, 1],
      TileMode.Clamp,
    ),
  );
  canvas.drawRect({ x: 0, y: 0, width: panel.width, height: panel.height }, washi);

  // 桟(格子)。框の内側だけに引く
  const bar = Skia.Paint();
  bar.setAntiAlias(true);
  bar.setColor(Skia.Color(SHOJI_COLORS.mullion));
  const innerX = panel.stile;
  const innerY = panel.stile;
  const innerW = Math.max(0, panel.width - panel.stile * 2);
  const innerH = Math.max(0, panel.height - panel.stile * 2);
  const half = panel.mullion / 2;
  for (const x of panel.verticals) {
    canvas.drawRect({ x: x - half, y: innerY, width: panel.mullion, height: innerH }, bar);
  }
  for (const y of panel.horizontals) {
    canvas.drawRect({ x: innerX, y: y - half, width: innerW, height: panel.mullion }, bar);
  }

  // 框の内側に落ちる影(枠と和紙の段差)
  const shadow = Skia.Paint();
  shadow.setAntiAlias(true);
  shadow.setColor(rgba(SHOJI_COLORS.stile, STILE_INNER_SHADOW_OPACITY));
  const lip = Math.max(1, Math.round(panel.mullion / 2));
  canvas.drawRect({ x: innerX, y: innerY, width: innerW, height: lip }, shadow);
  canvas.drawRect({ x: innerX, y: innerY, width: lip, height: innerH }, shadow);

  // 框(外枠)。和紙より暗く、桟より太い
  const frame = Skia.Paint();
  frame.setAntiAlias(true);
  frame.setColor(Skia.Color(SHOJI_COLORS.stile));
  const s = panel.stile;
  canvas.drawRect({ x: 0, y: 0, width: panel.width, height: s }, frame);
  canvas.drawRect({ x: 0, y: panel.height - s, width: panel.width, height: s }, frame);
  canvas.drawRect({ x: 0, y: 0, width: s, height: panel.height }, frame);
  canvas.drawRect({ x: panel.width - s, y: 0, width: s, height: panel.height }, frame);

  canvas.restore();

  // 和紙の粒(px 空間。庭の drawOverlay と同じ生成ノイズ + 暖色マトリクス)
  const grain = Skia.Paint();
  grain.setShader(
    Skia.Shader.MakeFractalNoise(GRAIN.baseFrequency, GRAIN.baseFrequency, GRAIN.octaves, 0, 0, 0),
  );
  const [gr, gg, gb] = GRAIN_RGB;
  grain.setColorFilter(
    Skia.ColorFilter.MakeMatrix([
      0, 0, 0, 0, gr,
      0, 0, 0, 0, gg,
      0, 0, 0, 0, gb,
      0.33, 0.33, 0.33, 0, 0,
    ]),
  );
  grain.setAlphaf(WASHI_GRAIN_OPACITY);
  canvas.drawRect({ x: 0, y: 0, width: wPx, height: hPx }, grain);

  return snapshotRaster(surface);
}
