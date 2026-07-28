// 閉じ際演出「とじる」(指示書 §3)。ホームの上に全画面で覆いをかけ、
// A 退場 → B 還り → C 一拍 → D 障子 → E 終了 を 1200ms の単一シーケンスで流す。
//
// この覆いが守ること:
//   - 文字・数値・アイコンを1ピクセルも出さない(§5)。この中に Text は置かない
//   - 毎回同一。日数・曜日・記録有無・課金状態で分岐しない(§5)。乱数も日付も使わん
//   - 演出中のどこを叩いても、残区間を飛ばして即座に E(§3)
//
// 庭は「ホームの窓と同じ固定パン」で全画面に焼くので、スクロール位置が
// 最上部でも最下部でも B 以降の見た目は変わらない(§7-3)。

import { useEffect, useRef, useState } from 'react';
import { PixelRatio, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, Group, Image as SkiaImage, Rect } from '@shopify/react-native-skia';
import Animated, {
  Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';
import { colors } from '@yaranai/core';

import { buildScene, FRAME_W, HOME_CROP, HOME_CX } from '../../lib/garden/scene';
import type { GrowthParams } from '../../lib/garden/growth';
import { bakeComposite } from '../garden/renderer';
import { useBaked } from '../garden/use-baked';
import { exitToBackground } from '../../lib/tojiru/exit';
import { shojiOffset, shojiPanel } from '../../lib/tojiru/shoji';
import { SINK_OPACITY, TOJIRU_TIMELINE as TL, washiOpacity } from '../../lib/tojiru/timeline';
import { bakeShojiPanel } from './bake';

// 入場の差分アニメと同系統の緩やかな ease。跳ね・バウンスは使わない(§3)
const ease = Easing.out(Easing.cubic);

type Props = {
  /**
   * 庭の現在状態。B で全画面に浮かべる。
   * 庭がまだ無い(石が一つも置かれとらん)ときは null で、生成りの地のまま障子が閉じる。
   */
  growth: GrowthParams | null;
};

export function TojiruCurtain({ growth }: Props) {
  const { width, height } = useWindowDimensions();
  const density = Math.min(2, PixelRatio.get());

  // ベイクは最初のフレームを描いたあとに回す。全画面ぶんの焼き付けは重く、
  // マウントと同じフレームで走らせるとタイムラインの起点が焼き時間ぶん遅れる。
  // 庭が要るのは 200ms、障子は 900ms からなので、1フレーム待っても間に合う。
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // 庭: ホームの窓と同じクロップ・同じ固定パンを、画面いっぱいに焼く。
  // 縦横比の差はベイク側がブリード(空と大地の色で伸ばす)で吸収する。
  const garden = useBaked(() => {
    if (!armed || !growth) return null;
    const viewW = FRAME_W * HOME_CROP;
    return bakeComposite(buildScene(growth), {
      pan: HOME_CX - viewW / 2,
      viewW,
      viewWPx: Math.max(1, Math.round(width * density)),
      viewHPx: Math.max(1, Math.round(height * density)),
    });
  }, [armed, growth, width, height, density]);

  const panel = shojiPanel(width, height);
  const shoji = useBaked(
    () => (armed ? bakeShojiPanel(panel, density) : null),
    [armed, width, height, density],
  );

  // ---- タイムライン(§3)。時刻はすべてタップからの相対ms ----
  const veil = useSharedValue(0); // A: 覆い全体の不透明度
  const sink = useSharedValue(0); // A: 背景の沈み
  const niwa = useSharedValue(0); // B: 庭のクロスフェード
  const close = useSharedValue(0); // D: 閉じ進行(0=開ききり〜1=閉じ切り)

  // E は一度きり。スキップとタイマーのどちらが先でも二重に走らせない
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    exitToBackground();
  };

  useEffect(() => {
    veil.value = withTiming(1, { duration: TL.exit.duration, easing: ease });
    sink.value = withTiming(SINK_OPACITY, { duration: TL.exit.duration, easing: ease });
    niwa.value = withDelay(
      TL.garden.start,
      withTiming(1, { duration: TL.garden.duration, easing: ease }),
    );
    // C(一拍)はここに何も置かない。庭のまま 400ms 静かに待つ
    close.value = withDelay(
      TL.shoji.start,
      withTiming(1, { duration: TL.shoji.duration, easing: ease }),
    );
    const timer = setTimeout(finish, TL.total);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));
  const washi = useDerivedValue(() => washiOpacity(close.value));
  const leftTransform = useDerivedValue(() => [
    { translateX: -shojiOffset(panel.width, close.value) },
  ]);
  // 右の一枚は同じ絵の左右反転。二枚の框が中央で出会う
  const rightTransform = useDerivedValue(() => [
    { translateX: width + shojiOffset(panel.width, close.value) },
    { scaleX: -1 },
  ]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, veilStyle]}>
      {/* 演出中の任意タップで残区間を省略し、即座に E(§3) */}
      <Pressable style={StyleSheet.absoluteFill} onPress={finish} accessible={false}>
        <Canvas style={StyleSheet.absoluteFill}>
          {/* A: 生成りの地。ここでホームのUIは覆われる */}
          <Rect x={0} y={0} width={width} height={height} color={colors.kinari} />
          {/* A: 背景がわずかに沈む */}
          <Rect x={0} y={0} width={width} height={height} color={colors.sumi} opacity={sink} />
          {/* B: 庭が全画面に浮かぶ。最後の視界は必ず庭になる */}
          {garden.value && (
            <SkiaImage
              image={garden.value}
              x={0}
              y={0}
              width={width}
              height={height}
              fit="fill"
              opacity={niwa}
            />
          )}
          {/* D: 障子が左右二枚、中央へ閉じる。閉じ切るまで和紙越しに庭が透ける */}
          {shoji.value && (
            <>
              <Group transform={leftTransform}>
                <SkiaImage
                  image={shoji.value}
                  x={0}
                  y={0}
                  width={panel.width}
                  height={panel.height}
                  fit="fill"
                  opacity={washi}
                />
              </Group>
              <Group transform={rightTransform}>
                <SkiaImage
                  image={shoji.value}
                  x={0}
                  y={0}
                  width={panel.width}
                  height={panel.height}
                  fit="fill"
                  opacity={washi}
                />
              </Group>
            </>
          )}
        </Canvas>
      </Pressable>
    </Animated.View>
  );
}
