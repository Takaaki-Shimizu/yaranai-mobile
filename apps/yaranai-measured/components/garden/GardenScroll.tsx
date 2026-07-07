// 庭モード(§5.2): 全画面の絵巻。横パンのみ、絵巻は有限(約2.75画面)。
// 端では優しく止まる(小さなラバーバンドのみ。ループ・追加読み込みはしない)。
// 開いた直後は中央からわずかに左へずらし、隣の景色を画面幅の7%だけ覗かせる。

import { useMemo } from 'react';
import { PixelRatio, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Canvas, Group, Image as SkiaImage, Rect } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  useDerivedValue, useSharedValue, withDecay, type SharedValue,
} from 'react-native-reanimated';

import type { GrowthParams } from '../../lib/garden/growth';
import {
  buildScene, EDGE_PEEK, PAN_CENTER, PAN_MAX, VIEW_LOGICAL_W, WORLD_H,
} from '../../lib/garden/scene';
import type { Scene } from '../../lib/garden/scene-types';
import { bakeLayers, bakeOverlay, type BakedLayer } from './renderer';

// ベイク解像度の上限(論理px→物理px)。メモリと精細さのバランスは実機で調整する
const MAX_BAKE_SCALE = 0.85;
// ラバーバンド: 端を越えて引ける量(論理px)と抵抗
const OVERSCROLL = 56;
const RESISTANCE = 0.3;

function bleedColors(scene: Scene): { sky: string; ground: string } {
  const sky = scene.paints.sky;
  const field = scene.paints.field;
  return {
    sky: sky.type === 'linear' ? sky.stops[0].color : '#EDE9D0',
    ground: field.type === 'linear' ? field.stops[2].color : '#54663C',
  };
}

type LayerProps = {
  baked: BakedLayer;
  panX: SharedValue<number>;
  dpScale: number;
};

function ParallaxLayer({ baked, panX, dpScale }: LayerProps) {
  const transform = useDerivedValue(() => [
    {
      translateX:
        (baked.originX - PAN_CENTER - (panX.value - PAN_CENTER) * baked.parallax) * dpScale,
    },
  ]);
  const w = (baked.image.width() / baked.scale) * dpScale;
  const h = (baked.image.height() / baked.scale) * dpScale;
  return (
    <Group transform={transform}>
      <SkiaImage image={baked.image} x={0} y={0} width={w} height={h} fit="fill" />
    </Group>
  );
}

type Props = { growth: GrowthParams };

export function GardenScroll({ growth }: Props) {
  const { width, height } = useWindowDimensions();
  const dpScale = width / VIEW_LOGICAL_W;
  const paintH = WORLD_H * dpScale;
  const offsetY = Math.max(0, (height - paintH) / 2);

  const scene = useMemo(() => buildScene(growth), [growth]);
  const layers = useMemo(() => {
    const density = Math.min(2, PixelRatio.get());
    const bakeScale = Math.min(dpScale * density, MAX_BAKE_SCALE);
    return bakeLayers(scene, bakeScale);
  }, [scene, dpScale]);
  const overlay = useMemo(() => {
    const density = Math.min(2, PixelRatio.get());
    return bakeOverlay(scene, Math.round(width * density), Math.round(height * density));
  }, [scene, width, height]);
  const bleed = useMemo(() => bleedColors(scene), [scene]);

  // エッジピーク: 中央よりわずかに左から始めて「先がある」ことを示唆する
  const pan = useSharedValue(PAN_CENTER - EDGE_PEEK);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-8, 8])
        .failOffsetY([-16, 16])
        .onChange((e) => {
          'worklet';
          const delta = -e.changeX / dpScale;
          const cur = pan.value;
          const out = cur < 0 || cur > PAN_MAX;
          let next = cur + delta * (out ? RESISTANCE : 1);
          if (next < -OVERSCROLL) next = -OVERSCROLL;
          if (next > PAN_MAX + OVERSCROLL) next = PAN_MAX + OVERSCROLL;
          pan.value = next;
        })
        .onEnd((e) => {
          'worklet';
          pan.value = withDecay({
            velocity: -e.velocityX / dpScale,
            clamp: [0, PAN_MAX],
            rubberBandEffect: true,
            rubberBandFactor: 0.9,
          });
        }),
    [dpScale, pan],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.fill} collapsable={false}>
        <Canvas style={styles.fill}>
          {/* 縦のブリード: 絵の上は空、下は大地の色で満たす */}
          <Rect x={0} y={0} width={width} height={height} color={bleed.sky} />
          <Rect x={0} y={offsetY + paintH / 2} width={width} height={height} color={bleed.ground} />
          <Group transform={[{ translateY: offsetY }]}>
            {layers.map((baked) => (
              <ParallaxLayer key={baked.id} baked={baked} panX={pan} dpScale={dpScale} />
            ))}
          </Group>
          {overlay && (
            <SkiaImage image={overlay} x={0} y={0} width={width} height={height} fit="fill" />
          )}
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
