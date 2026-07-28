// ホームの庭(§5.1): 全幅・画面高約60%の静止画。パン・ズーム不可。
// 絵巻の中央部(主石+道の起点)を切り取って一枚にベイクして表示する。
//
// 入庭時の差分演出(§変更4): 前回表示時の状態(prevGrowth)があり、かつ変化があれば、
// 前回状態を土台に、変化した要素だけを種別ごとに順にフェードインさせる。
// 各段は「前回状態〜その種別まで現在に寄せた合成画像」で、重ねて不透明度を上げると
// 変化したピクセルだけが現れる(単調非減少なので要素が消えることはない)。
//
// バックグラウンド復帰: 復帰のたびに焼き直し、Canvas も作り直す(use-baked.ts)。
// 復帰後は演出は既に済んどるけん、段を畳んで現在状態の一枚だけを焼く。

import { useEffect, useMemo } from 'react';
import { PixelRatio, useWindowDimensions } from 'react-native';
import { Canvas, Image as SkiaImage, type SkImage } from '@shopify/react-native-skia';
import { Easing, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import type { GrowthParams } from '../../lib/garden/growth';
import {
  changedCategories, diffStages, DIFF_ORDER, STAGE_TIMING, type DiffCategory,
} from '../../lib/garden/diff';
import { buildScene, FRAME_W, HOME_CROP, HOME_CX } from '../../lib/garden/scene';
import { bakeComposite } from './renderer';
import { useBaked } from './use-baked';

type Props = {
  growth: GrowthParams;
  height: number;
  /** 前回庭を表示した時点の状態。変化があればその差分だけを演出する(§変更4) */
  prevGrowth?: GrowthParams | null;
};

/** 土台の一枚と、その上に重ねる種別ごとの一枚。演出しないときは overlays が空 */
type GardenImages = {
  base: SkImage;
  overlays: { cat: DiffCategory; image: SkImage }[];
};

export function HomeGarden({ growth, height, prevGrowth }: Props) {
  const { width } = useWindowDimensions();

  const categories = useMemo(
    () => changedCategories(prevGrowth ?? null, growth),
    [prevGrowth, growth],
  );

  // 種別ごとの不透明度(演出用)。初期は 0(土台=前回状態から始め、変化分をフェードインさせる)
  const opMoss = useSharedValue(0);
  const opCobble = useSharedValue(0);
  const opLight = useSharedValue(0);
  const opStone = useSharedValue(0);
  const opByCat: Record<DiffCategory, typeof opMoss> = {
    moss: opMoss, cobble: opCobble, light: opLight, stone: opStone,
  };

  // 土台(前回状態)+ 種別ごとの中間状態を、それぞれ合成画像にベイクする。
  // ひとつでも焼けんかったら null を返し、直前に焼けた絵を出したまま焼き直す。
  const baked = useBaked<GardenImages>((generation) => {
    // 復帰後(generation > 0)は演出が済んどるけん、段を畳んで現在状態の一枚だけ焼く
    const animate = generation === 0 && (prevGrowth ?? null) != null && categories.length > 0;
    const density = Math.min(2, PixelRatio.get());
    const viewWPx = Math.max(1, Math.round(width * density));
    const viewHPx = Math.max(1, Math.round(height * density));
    // §変更1: 構図の横 90%・縦 100% を中心基準でクロップ(上トリムなし)。
    // 窓のアスペクトは 1350:1000 = 1.35:1(index.tsx が height をこの比で決める)。
    const viewW = FRAME_W * HOME_CROP;
    const opts = { pan: HOME_CX - viewW / 2, viewW, viewWPx, viewHPx };
    const stages = animate ? diffStages(prevGrowth!, growth, categories) : [growth];
    const images = stages.map((g) => bakeComposite(buildScene(g), opts));
    if (images.some((img) => img == null)) return null;
    return {
      base: images[0]!,
      overlays: (animate ? categories : []).map((cat, i) => ({ cat, image: images[i + 1]! })),
    };
  }, [growth, prevGrowth, categories, width, height]);

  // 変化の署名。これが変わったときだけ演出をやり直す
  const animate = (baked.value?.overlays.length ?? 0) > 0;
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
    // key: バックグラウンド復帰のたびに Canvas ごと作り直し、描き直しを確実にする
    <Canvas key={baked.generation} style={{ width, height }}>
      {/* 土台: 前回状態(演出しないときは現在状態そのもの) */}
      {baked.value && (
        <SkiaImage image={baked.value.base} x={0} y={0} width={width} height={height} fit="fill" />
      )}
      {/* 変化した要素を種別順にフェードインで重ねる */}
      {(baked.value?.overlays ?? []).map(({ cat, image }) => (
        <SkiaImage
          key={cat}
          image={image}
          x={0}
          y={0}
          width={width}
          height={height}
          fit="fill"
          opacity={opByCat[cat]}
        />
      ))}
    </Canvas>
  );
}
