// 和紙意匠(和紙意匠 実装指示書)。ホーム画面のヘッダー/フッターに敷く
// 紙片+金箔と、画面全面の紙肌(grain)。静的描画のみ(§8: アニメーション禁止)。
//
// 構造ルール(§2): 意匠レイヤーは所属コンポーネントに内包させ、画面全体に対する
// 絶対座標では配置しない(画面高さの変動で帯とズレるため)。
//   - HeaderWashi はヘッダー帯の wrapper 内の最背面に置く
//   - FooterWashi は AppFooter の帯の内側に置き、帯の境界でクリップする
//   - GrainOverlay のみ例外として全画面オーバーレイ
//
// mottle(§6)は SVG フィルタと同じく FractalNoise の輝度をアルファへ変換した
// マスクを紙片群にかける。Skia の PerlinNoise は SVG の feTurbulence と同系の
// 実装のため、同じ baseFrequency / octaves / seed でモックと同じムラが出る。

import { StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  Canvas, ColorMatrix, Fill, FractalNoise, Group, Mask, Path, Rect,
} from '@shopify/react-native-skia';
import type { Transforms3d } from '@shopify/react-native-skia';
import {
  FOOTER_BASE_HEIGHT, FOOTER_FOILS, FOOTER_PIECES, GRAIN, GRAIN_DESATURATE_MATRIX,
  HEADER_FOILS, HEADER_MOTIF_HEIGHT, HEADER_PIECES, MOTIF_BASE_WIDTH, MOTTLE,
  MOTTLE_ALPHA_MATRIX, piecePath, type Foil, type PaperPiece,
} from '../../lib/washi/motif';

// マスク用ノイズ矩形の外周余白。紙片の頂点が負座標(帯の外)まで届くため、
// 基準サイズより広く取っておく(ローカル座標。描画は帯の境界でクリップされる)
const MASK_PAD = 80;

/** 紙片群に mottle マスクをかけて描く。transform はマスクと紙片の両方に同じものをかける */
function MottledPieces({ pieces, freqY, baseHeight, transform }: {
  pieces: readonly PaperPiece[];
  freqY: number;
  baseHeight: number;
  transform: Transforms3d;
}) {
  return (
    <Mask
      mode="alpha"
      mask={
        <Group transform={transform}>
          <Rect
            x={-MASK_PAD}
            y={-MASK_PAD}
            width={MOTIF_BASE_WIDTH + MASK_PAD * 2}
            height={baseHeight + MASK_PAD * 2}
          >
            <FractalNoise
              freqX={MOTTLE.baseFrequency}
              freqY={freqY}
              octaves={MOTTLE.octaves}
              seed={MOTTLE.seed}
            />
            <ColorMatrix matrix={[...MOTTLE_ALPHA_MATRIX]} />
          </Rect>
        </Group>
      }
    >
      <Group transform={transform}>
        {pieces.map((p, i) => (
          <Path key={i} path={piecePath(p)} color={p.fill} opacity={p.opacity} />
        ))}
      </Group>
    </Mask>
  );
}

/** 金箔。中心まわりに回転させる(mottle はかけない) */
function FoilRect({ foil }: { foil: Foil }) {
  return (
    <Rect
      x={foil.x}
      y={foil.y}
      width={foil.size}
      height={foil.size}
      color={foil.fill}
      opacity={foil.opacity}
      origin={{ x: foil.x + foil.size / 2, y: foil.y + foil.size / 2 }}
      transform={[{ rotate: (foil.rotate * Math.PI) / 180 }]}
    />
  );
}

/**
 * ヘッダー意匠(§4): 紙片2枚+金箔2粒。ヘッダー帯 wrapper の最初の子として置き、
 * 帯の上端にアンカーする。座標は幅390dp基準の等倍スケール(モックの
 * preserveAspectRatio="xMidYMin slice" 相当)。
 */
export function HeaderWashi() {
  const { width } = useWindowDimensions();
  const scale = width / MOTIF_BASE_WIDTH;
  const transform: Transforms3d = [{ scale }];
  return (
    <View
      pointerEvents="none"
      style={[styles.headerMotif, { height: Math.ceil(HEADER_MOTIF_HEIGHT * scale) }]}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <MottledPieces
          pieces={HEADER_PIECES}
          freqY={MOTTLE.baseFrequency}
          baseHeight={HEADER_MOTIF_HEIGHT}
          transform={transform}
        />
        <Group transform={transform}>
          {HEADER_FOILS.map((f, i) => (
            <FoilRect key={i} foil={f} />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}

/**
 * フッター意匠(§5): 紙片5枚+金箔2粒。AppFooter の帯の内側(アイコンより背面)に
 * 置く。帯の実高(height)へ縦をストレッチして追従し(preserveAspectRatio: none 相当)、
 * overflow: hidden で帯の境界にクリップする。上端のヘアラインは帯の border なので、
 * 意匠がそれより上に出ることは構造的にない。
 */
export function FooterWashi({ height }: { height: number }) {
  const { width } = useWindowDimensions();
  const scaleX = width / MOTIF_BASE_WIDTH;
  const transform: Transforms3d = [
    { scaleX },
    { scaleY: height / FOOTER_BASE_HEIGHT },
  ];
  return (
    <View pointerEvents="none" style={styles.footerClip}>
      <Canvas style={StyleSheet.absoluteFill}>
        <MottledPieces
          pieces={FOOTER_PIECES}
          freqY={MOTTLE.footerFreqY}
          baseHeight={FOOTER_BASE_HEIGHT}
          transform={transform}
        />
        {/* 箔は縦ストレッチに載せない: 正方形のまま、帯上端からの dp 位置に置く。
            ストレッチすると下インセットの大きい端末で箔がアイコン帯の外へ沈む。
            横位置だけ画面幅に追従させる */}
        {FOOTER_FOILS.map((f, i) => (
          <FoilRect key={i} foil={{ ...f, x: f.x * scaleX }} />
        ))}
      </Canvas>
    </View>
  );
}

/**
 * grain 紙肌(§7): 画面全体をコンテンツより前面から multiply 0.05 で覆う。
 * ノイズシェーダは無限平面なのでタイル繰り返しは不要(見た目はモックの
 * 220dpタイルと同等で、継ぎ目が出ないぶん素直)。タップは素通しする。
 */
export function GrainOverlay() {
  return (
    <View pointerEvents="none" style={styles.grain}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill>
          <FractalNoise
            freqX={GRAIN.baseFrequency}
            freqY={GRAIN.baseFrequency}
            octaves={GRAIN.octaves}
            seed={GRAIN.seed}
          />
          <ColorMatrix matrix={[...GRAIN_DESATURATE_MATRIX]} />
        </Fill>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  headerMotif: { position: 'absolute', top: 0, left: 0, right: 0 },
  footerClip: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  grain: {
    ...StyleSheet.absoluteFillObject,
    opacity: GRAIN.opacity,
    mixBlendMode: 'multiply',
  },
});
