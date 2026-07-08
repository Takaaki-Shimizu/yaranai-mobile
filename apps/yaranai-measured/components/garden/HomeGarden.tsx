// ホームの庭(§5.1): 全幅・画面高約60%の静止画。パン・ズーム不可。
// 絵巻の中央部(主石+道の起点)を切り取って一枚にベイクして表示する。
//
// 入庭時の差分演出(§変更4): 前回表示時の状態(prevGrowth)があり、かつ変化があれば、
// 前回状態を土台に、変化した要素だけを種別ごとに順にフェードインさせる。
// 各段は「前回状態〜その種別まで現在に寄せた合成画像」で、重ねて不透明度を上げると
// 変化したピクセルだけが現れる(単調非減少なので要素が消えることはない)。

import { useEffect, useMemo } from 'react';
import { PixelRatio, useWindowDimensions } from 'react-native';
import { Canvas, Image as SkiaImage } from '@shopify/react-native-skia';
import { Easing, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import type { GrowthParams } from '../../lib/garden/growth';
import {
  changedCategories, diffStages, DIFF_ORDER, STAGE_TIMING, type DiffCategory,
} from '../../lib/garden/diff';
import { buildScene, FRAME_W, HOME_CROP, HOME_CX } from '../../lib/garden/scene';
import { bakeComposite } from './renderer';

type Props = {
  growth: GrowthParams;
  height: number;
  /** 前回庭を表示した時点の状態。変化があればその差分だけを演出する(§変更4) */
  prevGrowth?: GrowthParams | null;
};

export function HomeGarden({ growth, height, prevGrowth }: Props) {
  const { width } = useWindowDimensions();

  const categories = useMemo(
    () => changedCategories(prevGrowth ?? null, growth),
    [prevGrowth, growth],
  );
  const animate = (prevGrowth ?? null) != null && categories.length > 0;

  // 土台(前回状態)+ 種別ごとの中間状態を、それぞれ合成画像にベイクする
  const images = useMemo(() => {
    const density = Math.min(2, PixelRatio.get());
    const viewWPx = Math.max(1, Math.round(width * density));
    const viewHPx = Math.max(1, Math.round(height * density));
    // §変更1: 構図の横 90%・縦 100% を中心基準でクロップ(上トリムなし)。
    // 窓のアスペクトは 1350:1000 = 1.35:1(index.tsx が height をこの比で決める)。
    const viewW = FRAME_W * HOME_CROP;
    const opts = { pan: HOME_CX - viewW / 2, viewW, viewWPx, viewHPx };
    const stages = animate ? diffStages(prevGrowth!, growth, categories) : [growth];
    return stages.map((g) => bakeComposite(buildScene(g), opts));
  }, [growth, prevGrowth, categories, animate, width, height]);

  // 種別ごとの不透明度(演出用)。初期は 0(土台=前回状態から始め、変化分をフェードインさせる)
  const opMoss = useSharedValue(0);
  const opCobble = useSharedValue(0);
  const opLight = useSharedValue(0);
  const opStone = useSharedValue(0);
  const opByCat: Record<DiffCategory, typeof opMoss> = {
    moss: opMoss, cobble: opCobble, light: opLight, stone: opStone,
  };

  // 変化の署名。これが変わったときだけ演出をやり直す
  const signature = useMemo(
    () =>
      animate
        ? `${categories.join(',')}#${growth.moss.toFixed(4)}:${growth.recordedDays}:${growth.weeks}:${growth.stones}`
        : '',
    [animate, categories, growth],
  );

  useEffect(() => {
    if (!animate) return;
    for (const cat of DIFF_ORDER) {
      if (categories.includes(cat)) {
        const t = STAGE_TIMING[cat];
        opByCat[cat].value = 0;
        opByCat[cat].value = withDelay(
          t.delay,
          withTiming(1, { duration: t.duration, easing: Easing.out(Easing.cubic) }),
        );
      } else {
        opByCat[cat].value = 1;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (
    <Canvas style={{ width, height }}>
      {/* 土台: 前回状態(演出しないときは現在状態そのもの) */}
      {images[0] && (
        <SkiaImage image={images[0]} x={0} y={0} width={width} height={height} fit="fill" />
      )}
      {/* 変化した要素を種別順にフェードインで重ねる */}
      {animate &&
        categories.map((cat, i) => {
          const img = images[i + 1];
          return img ? (
            <SkiaImage
              key={cat}
              image={img}
              x={0}
              y={0}
              width={width}
              height={height}
              fit="fill"
              opacity={opByCat[cat]}
            />
          ) : null;
        })}
    </Canvas>
  );
}
