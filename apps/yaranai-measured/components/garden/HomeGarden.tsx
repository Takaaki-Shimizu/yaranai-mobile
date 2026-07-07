// ホームの庭(§5.1): 全幅・画面高約60%の静止画。パン・ズーム不可。
// 絵巻の中央部(主石+道の起点)を切り取って一枚にベイクして表示する。

import { useMemo } from 'react';
import { PixelRatio, useWindowDimensions } from 'react-native';
import { Canvas, Image as SkiaImage } from '@shopify/react-native-skia';
import type { GrowthParams } from '../../lib/garden/growth';
import { buildScene, HOME_CX, WORLD_H } from '../../lib/garden/scene';
import { bakeComposite } from './renderer';

type Props = {
  growth: GrowthParams;
  height: number;
};

export function HomeGarden({ growth, height }: Props) {
  const { width } = useWindowDimensions();
  const image = useMemo(() => {
    const density = Math.min(2, PixelRatio.get());
    const viewWPx = Math.max(1, Math.round(width * density));
    const viewHPx = Math.max(1, Math.round(height * density));
    // 絵の高さ(800)を窓に収め、見える論理幅は端末の縦横比なり
    const viewW = viewWPx / (viewHPx / WORLD_H);
    const scene = buildScene(growth);
    return bakeComposite(scene, { pan: HOME_CX - viewW / 2, viewW, viewWPx, viewHPx });
  }, [growth, width, height]);

  return (
    <Canvas style={{ width, height }}>
      {image && <SkiaImage image={image} x={0} y={0} width={width} height={height} fit="fill" />}
    </Canvas>
  );
}
