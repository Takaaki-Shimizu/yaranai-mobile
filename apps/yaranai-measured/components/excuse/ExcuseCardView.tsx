// カードの表示(指示書 §4.3)。9:16版を全画面で出す ── 対面提示をこの画面が兼ねる。
//
// 完成演出(§4.2-3)は起動演出と同じ2段構成。夜色の地が先に現れ、灯りが灯り(光量が先)、
// 宣言文が浮かぶ(輪郭が後)。総尺 2000ms・有限・タップでスキップ可。
// reduce motion のときは演出を組まず、最終状態を即時に出す(§4.2-4)。
//
// 焼き直しはバックグラウンド復帰のたびに走る(use-baked)。復帰後は演出済みなので、
// 3層とも不透明度1で出す。

import { useEffect } from 'react';
import { PixelRatio, Pressable, StyleSheet, View } from 'react-native';
import { Canvas, Image as SkiaImage } from '@shopify/react-native-skia';
import { Easing, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { CARD_LAYOUTS } from '../../lib/excuse/card-spec';
import { EXCUSE_REVEAL_TIMELINE as TL } from '../../lib/excuse/timeline';
import { useBaked } from '../garden/use-baked';
import { bakeCardLayers, type CardContent, type CardLayers } from './bake';

type Props = {
  content: CardContent;
  /** 表示領域(9:16の縦を基準に、はみ出さない大きさへ収める) */
  width: number;
  height: number;
  /** 完成演出を再生するか。false なら最終状態を即時に出す */
  reveal: boolean;
  /** 演出が終わった(またはスキップされた)とき */
  onRevealEnd?: () => void;
  /** カードを触ったとき。演出中はスキップが優先される */
  onPress?: () => void;
};

export function ExcuseCardView({ content, width, height, reveal, onRevealEnd, onPress }: Props) {
  const layout = CARD_LAYOUTS.story;
  // 版面のアスペクトを保ったまま、与えられた枠に収める
  const scale = Math.min(width / layout.width, height / layout.height);
  const drawW = layout.width * scale;
  const drawH = layout.height * scale;

  const ground = useSharedValue(reveal ? 0 : 1);
  const light = useSharedValue(reveal ? 0 : 1);
  const text = useSharedValue(reveal ? 0 : 1);

  // 焼く実ピクセルは「表示幅 × 端末の画素密度」。版下(1080px)を超えて焼く意味はない。
  // 対面提示ではこのカードのQRを実機カメラで読むので、ここを落として粗くしてはいけない
  const pixelScale = Math.min(1, (drawW * PixelRatio.get()) / layout.width);

  const baked = useBaked<CardLayers>(
    () => bakeCardLayers('story', content, pixelScale),
    [
      content.lines.join('\n'), content.date, content.custody.join('\n'),
      content.qrLabel, content.url, Math.round(pixelScale * 1000),
    ],
  );

  // 焼き上がってから灯す。焼き上がりが遅れても、演出の頭から見せる
  const ready = baked.value != null;
  const generation = baked.generation;

  useEffect(() => {
    if (!ready) return;
    // 復帰(generation > 0)では演出は済んでいる。畳んで最終状態を出す
    if (!reveal || generation > 0) {
      ground.value = 1;
      light.value = 1;
      text.value = 1;
      return;
    }
    // 焼き上がりを待って灯すので、ここで0へ戻してから流す
    // (reveal が後から立ったときも、必ず消えた状態から始まる)
    const ease = Easing.out(Easing.cubic);
    ground.value = 0;
    light.value = 0;
    text.value = 0;
    ground.value = withDelay(TL.ground.delay, withTiming(1, { duration: TL.ground.duration, easing: ease }));
    light.value = withDelay(TL.light.delay, withTiming(1, { duration: TL.light.duration, easing: ease }));
    text.value = withDelay(TL.text.delay, withTiming(1, { duration: TL.text.duration, easing: ease }));
    const timer = setTimeout(() => onRevealEnd?.(), TL.total);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, reveal, generation]);

  // スキップ: 演出中はどこを触っても最終状態へ飛ぶ。促す印は出さない
  const skip = () => {
    ground.value = 1;
    light.value = 1;
    text.value = 1;
    onRevealEnd?.();
  };

  return (
    <Pressable onPress={reveal ? skip : onPress} disabled={!reveal && !onPress} style={styles.frame}>
      <View style={{ width: drawW, height: drawH }}>
        <Canvas key={baked.generation} style={{ width: drawW, height: drawH }}>
          {baked.value && (
            <>
              <SkiaImage
                image={baked.value.ground}
                x={0} y={0} width={drawW} height={drawH} fit="fill" opacity={ground}
              />
              <SkiaImage
                image={baked.value.light}
                x={0} y={0} width={drawW} height={drawH} fit="fill" opacity={light}
              />
              <SkiaImage
                image={baked.value.text}
                x={0} y={0} width={drawW} height={drawH} fit="fill" opacity={text}
              />
            </>
          )}
        </Canvas>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center' },
});
