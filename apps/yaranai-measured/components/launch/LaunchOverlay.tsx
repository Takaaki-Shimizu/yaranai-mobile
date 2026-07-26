// 起動演出「小径」(起動演出指示書・最終版)。
// 完全な闇 → 夜が明けるように竹林の小径が現れる → 開口部の光の中に「Yaranai」が灯り、
// 「ここから、変わる。」が続く → ホームへ。演出は 2000ms 固定(§4)、その後
// 題字を読み取れるだけ最終フレームで静止してからホームへ(holdAfterPlay)。
// バックグラウンド復帰(variant="still")は演出を流さず最終フレームの静止画だけを挟む。
//
// 層構成(下から): 竹林ベイク画像(カメラ静定 scale 1.04→1) → 光3つ(screen 合成)
// → 帳(黒) → 影の暈 → 題字グロー下層(ぼかし) …ここまで Skia Canvas。
// その上に RN Text の題字(上層・シャープ)とコピー(ヘッダーと同一フォント §9)。
// ルート View の背景を #000 にしてあるので、Canvas 初期化前の最初のフレームから黒(§8-5)。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, PixelRatio, StyleSheet, View, useWindowDimensions,
} from 'react-native';
import {
  Canvas, Circle, Group, Image as SkiaImage, RadialGradient, Rect, vec,
} from '@shopify/react-native-skia';
import Animated, {
  Easing, runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue,
  withDelay, withSequence, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { fonts } from '@yaranai/core';

import { coverTransform, KOMICHI_LAYOUT, VANISHING_POINT } from '../../lib/launch/komichi';
import { LAUNCH_TIMELINE as TL } from '../../lib/launch/timeline';
import { bakeKomichi, bakeTitleGlow } from './bake';

const easeOutCubic = Easing.out(Easing.cubic);
const camEase = Easing.bezier(0.25, 0.5, 0.3, 1);

type BloomSpec = {
  cx: number; cy: number; rx: number; ry: number;
  color: string; alpha: number; fade: number;
};

/** 開口部の光(radial の楕円、screen 合成)。scale/lift は Reanimated 駆動 */
function Bloom({ spec, opacity, scale, lift }: {
  spec: BloomSpec;
  opacity: SharedValue<number>;
  scale?: SharedValue<number>;
  lift?: SharedValue<number>;
}) {
  const transform = useDerivedValue(() => [
    { translateX: spec.cx },
    { translateY: spec.cy + (lift ? lift.value : 0) },
    { scale: scale ? scale.value : 1 },
    { scaleY: spec.ry / spec.rx },
  ]);
  return (
    <Group transform={transform}>
      <Circle cx={0} cy={0} r={spec.rx} opacity={opacity} blendMode="screen">
        <RadialGradient
          c={vec(0, 0)}
          r={spec.rx}
          colors={[`rgba(${spec.color},${spec.alpha})`, `rgba(${spec.color},0)`]}
          positions={[0, spec.fade]}
        />
      </Circle>
    </Group>
  );
}

type Props = {
  /** ホーム(ルート)の準備が済んだか。2000ms 経過後もこれが偽の間は最終フレームで静止(§5) */
  ready: boolean;
  /**
   * full: 演出をフルで流す(コールド起動)。
   * still: 演出を流さず最終フレームの静止画だけを見せる(バックグラウンド復帰)
   */
  variant: 'full' | 'still';
  /** フェードアウト完了(アンマウントしてよいタイミング)の通知 */
  onDone: () => void;
};

export function LaunchOverlay({ ready, variant, onDone }: Props) {
  const { width, height } = useWindowDimensions();
  const density = Math.min(2, PixelRatio.get());
  const cover = coverTransform(width, height);
  const toX = (x: number) => cover.ox + x * cover.s;
  const toY = (y: number) => cover.oy + y * cover.s;

  // 竹林とグロー層は最初のレンダーで同期ベイク(1回きり。以後は画像を置くだけ)
  const sceneImage = useMemo(
    () => bakeKomichi(Math.max(1, Math.round(width * density)), Math.max(1, Math.round(height * density))),
    [width, height, density],
  );
  const titleSize = KOMICHI_LAYOUT.title.fontSize * cover.s;
  const titleSpacing = KOMICHI_LAYOUT.title.letterSpacing * cover.s;
  const glow = useMemo(
    () =>
      bakeTitleGlow({
        text: KOMICHI_LAYOUT.title.text,
        fontFamily: fonts.serif ?? 'serif',
        fontSizePx: titleSize * density,
        letterSpacingPx: titleSpacing * density,
        blurPx: 11 * cover.s * density,
      }),
    [titleSize, titleSpacing, density, cover.s],
  );

  // 文字まわりのレイアウト(シーン座標→画面座標)。中心光の真後ろに文字が来る(§3)
  const brandTop = toY(KOMICHI_LAYOUT.brandTop);
  const titleLineHeight = Math.round(titleSize * 1.3);
  const copySize = KOMICHI_LAYOUT.copy.fontSize * cover.s;
  const copySpacing = KOMICHI_LAYOUT.copy.letterSpacing * cover.s;
  const titleCenterY = brandTop + titleLineHeight / 2;

  const bloomSpec = (l: { cx: number; cy: number; rx: number; ry: number; color: string; alpha: number; fade: number }): BloomSpec => ({
    cx: toX(l.cx), cy: toY(l.cy), rx: l.rx * cover.s, ry: l.ry * cover.s,
    color: l.color, alpha: l.alpha, fade: l.fade,
  });
  const coreSpec = bloomSpec(KOMICHI_LAYOUT.lights.core);
  const leftSpec = bloomSpec(KOMICHI_LAYOUT.lights.left);
  const rightSpec = bloomSpec(KOMICHI_LAYOUT.lights.right);
  const halo = KOMICHI_LAYOUT.halo;

  // ---- アニメーション値(§4 のタイムライン) ----
  const rootOpacity = useSharedValue(1);
  const veil = useSharedValue(1);
  const cam = useSharedValue<number>(TL.camera.from);
  const coreOp = useSharedValue(0);
  const coreScale = useSharedValue<number>(TL.core.scaleFrom);
  const leftOp = useSharedValue(0);
  const rightOp = useSharedValue(0);
  const leftLift = useSharedValue(TL.side.liftFrom * cover.s);
  const rightLift = useSharedValue(TL.side.liftFrom * cover.s);
  const haloOp = useSharedValue(0);
  const glowOp = useSharedValue(0);
  const titleOp = useSharedValue(0);
  const copyOp = useSharedValue(0);

  // static: 最終フレームの静止画を即時表示する(バックグラウンド復帰の still、
  // または OS の reduce motion §6)。play の判定が返るまでは黒のまま(冒頭250msの黒が吸収する)
  const [mode, setMode] = useState<'pending' | 'play' | 'static'>(
    variant === 'still' ? 'static' : 'pending',
  );
  useEffect(() => {
    if (variant === 'still') return; // 最初から static
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (alive) setMode(v ? 'static' : 'play'); })
      .catch(() => { if (alive) setMode('play'); });
    return () => { alive = false; };
  }, [variant]);

  // played = 最終フレームが表示済み。playedAt からの経過が完了後ホールドの起点になる
  const [played, setPlayed] = useState(false);
  const playedAtRef = useRef(0);
  useEffect(() => {
    if (mode === 'pending') return;
    const markPlayed = () => {
      playedAtRef.current = Date.now();
      setPlayed(true);
    };
    if (mode === 'static') {
      veil.value = 0;
      cam.value = 1;
      coreOp.value = TL.core.rest;
      coreScale.value = 1;
      leftOp.value = TL.side.rest;
      rightOp.value = TL.side.rest;
      leftLift.value = TL.side.liftTo * cover.s;
      rightLift.value = TL.side.liftTo * cover.s;
      haloOp.value = 1;
      glowOp.value = TL.glow.rest;
      titleOp.value = 1;
      copyOp.value = TL.copy.rest;
      markPlayed();
      return;
    }

    // 帳: 夜明け(easeInOut)
    veil.value = withDelay(
      TL.veil.delay,
      withTiming(0, { duration: TL.veil.duration, easing: Easing.inOut(Easing.ease) }),
    );
    // カメラ静定(原点=消失点)
    cam.value = withDelay(TL.camera.delay, withTiming(1, { duration: TL.camera.duration, easing: camEase }));
    // 中心光: ふわっと灯って静かに据わる
    coreOp.value = withDelay(TL.core.delay, withSequence(
      withTiming(TL.core.peak, { duration: TL.core.duration * TL.core.peakAt, easing: easeOutCubic }),
      withTiming(TL.core.rest, { duration: TL.core.duration * (1 - TL.core.peakAt), easing: easeOutCubic }),
    ));
    coreScale.value = withDelay(
      TL.core.delay,
      withTiming(1, { duration: TL.core.duration, easing: easeOutCubic }),
    );
    // 側光(左下・右)
    for (const [op, lift, delay] of [
      [leftOp, leftLift, TL.side.delayLeft],
      [rightOp, rightLift, TL.side.delayRight],
    ] as const) {
      op.value = withDelay(delay, withSequence(
        withTiming(TL.side.peak, { duration: TL.side.duration * TL.side.peakAt, easing: easeOutCubic }),
        withTiming(TL.side.rest, { duration: TL.side.duration * (1 - TL.side.peakAt), easing: easeOutCubic }),
      ));
      lift.value = withDelay(
        delay,
        withTiming(TL.side.liftTo * cover.s, { duration: TL.side.duration, easing: easeOutCubic }),
      );
    }
    // 影の暈 → 題字(光量が先、輪郭が後)→ コピー
    haloOp.value = withDelay(TL.halo.delay, withTiming(1, { duration: TL.halo.duration, easing: easeOutCubic }));
    glowOp.value = withDelay(TL.glow.delay, withSequence(
      withTiming(1, { duration: TL.glow.rise, easing: easeOutCubic }),
      withTiming(TL.glow.rest, { duration: TL.glow.settle, easing: easeOutCubic }),
    ));
    titleOp.value = withDelay(TL.title.delay, withTiming(1, { duration: TL.title.duration, easing: easeOutCubic }));
    copyOp.value = withDelay(TL.copy.delay, withTiming(TL.copy.rest, { duration: TL.copy.duration, easing: easeOutCubic }));

    const t = setTimeout(markPlayed, TL.total);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // 完了かつホーム準備済みで、題字を読み取れるだけ静止してからフェードアウト
  // (§5: ロードが長い間は最終フレームで静止して待つ。スピナー等は出さない)。
  // ロード待ちで既に静止していた時間はホールドから差し引く。
  // フェードが終わったらアンマウント通知。
  const finish = useCallback(() => onDone(), [onDone]);
  const fading = useRef(false);
  useEffect(() => {
    if (!played || !ready || fading.current) return;
    fading.current = true;
    const minHold = variant === 'full' ? TL.holdAfterPlay : TL.stillHold;
    const hold = Math.max(0, minHold - (Date.now() - playedAtRef.current));
    const t = setTimeout(() => {
      rootOpacity.value = withTiming(
        0,
        { duration: TL.homeFadeOut, easing: Easing.inOut(Easing.ease) },
        (finished) => {
          'worklet';
          if (finished) runOnJS(finish)();
        },
      );
    }, hold);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [played, ready]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOp.value }));
  const copyStyle = useAnimatedStyle(() => ({ opacity: copyOp.value }));
  const camTransform = useDerivedValue(() => [{ scale: cam.value }]);
  const haloTransform = useMemo(
    () => [
      { translateX: toX(halo.cx) },
      { translateY: toY(halo.cy) },
      { scaleY: halo.ry / halo.rx },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height],
  );

  const glowW = glow ? glow.width / density : 0;
  const glowH = glow ? glow.height / density : 0;

  return (
    <Animated.View style={[styles.root, rootStyle]} pointerEvents="auto">
      <Canvas style={StyleSheet.absoluteFill}>
        {sceneImage && (
          <Group transform={camTransform} origin={vec(toX(VANISHING_POINT.x), toY(VANISHING_POINT.y))}>
            <SkiaImage image={sceneImage} x={0} y={0} width={width} height={height} fit="fill" />
          </Group>
        )}
        <Bloom spec={coreSpec} opacity={coreOp} scale={coreScale} />
        <Bloom spec={leftSpec} opacity={leftOp} lift={leftLift} />
        <Bloom spec={rightSpec} opacity={rightOp} lift={rightLift} />
        {/* 帳(完全な黒→夜明け)。光の上・文字の下に置く(モックと同じ層) */}
        <Rect x={0} y={0} width={width} height={height} color="#000000" opacity={veil} />
        {/* 影の暈: 文字の可読性の保険 */}
        <Group transform={haloTransform}>
          <Circle cx={0} cy={0} r={halo.rx * cover.s} opacity={haloOp}>
            <RadialGradient
              c={vec(0, 0)}
              r={halo.rx * cover.s}
              colors={[`rgba(${halo.color},${halo.alpha})`, `rgba(${halo.color},0)`]}
              positions={[0, halo.fade]}
            />
          </Circle>
        </Group>
        {/* 題字グロー下層(ぼかしの発光層) */}
        {glow && (
          <SkiaImage
            image={glow.image}
            x={width / 2 - glowW / 2 + titleSpacing / 2}
            y={titleCenterY - glowH / 2}
            width={glowW}
            height={glowH}
            fit="fill"
            opacity={glowOp}
          />
        )}
      </Canvas>

      {/* 題字上層(シャープ)とコピー。アプリヘッダーと同一のフォント(§9) */}
      <View style={[styles.brand, { top: brandTop }]} pointerEvents="none">
        <Animated.Text
          style={[
            styles.title,
            {
              fontSize: titleSize,
              lineHeight: titleLineHeight,
              letterSpacing: titleSpacing,
              paddingLeft: titleSpacing,
              textShadowOffset: { width: 0, height: cover.s },
              textShadowRadius: 5 * cover.s,
            },
            titleStyle,
          ]}
        >
          {KOMICHI_LAYOUT.title.text}
        </Animated.Text>
        <Animated.Text
          style={[
            styles.copy,
            {
              fontSize: copySize,
              marginTop: KOMICHI_LAYOUT.copy.marginTop * cover.s,
              letterSpacing: copySpacing,
              paddingLeft: copySpacing,
              textShadowOffset: { width: 0, height: cover.s },
              textShadowRadius: 5 * cover.s,
            },
            copyStyle,
          ]}
        >
          {KOMICHI_LAYOUT.copy.text}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 背景 #000: Canvas が最初のフレームを描く前から画面を完全な黒にする(§8-5)
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000' },
  brand: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  title: {
    fontFamily: fonts.serif,
    color: KOMICHI_LAYOUT.moji,
    textShadowColor: 'rgba(22,26,16,0.55)',
  },
  copy: {
    fontFamily: fonts.serif,
    color: KOMICHI_LAYOUT.moji,
    textShadowColor: 'rgba(22,26,16,0.55)',
  },
});
