// 画面遷移の所作「墨入れ」。全画面が同じ生成りの地を敷いているため、画面の切替は
// 「紙の差し替え」ではなく「同じ紙の上で墨が入れ替わる」ものとして扱う。
//
// Android のネイティブ遷移は 150ms 固定で、時間もかたちも御せない。所作は
// すべてJS側で持ち、遷移を三拍で運ぶ:
//
//   1. 筆を引く … いまの画面の墨が静かに沈む(useSumiireRouter が遷移の前に流す)
//   2. 間      … 生成りの紙だけが残る(Stack の fade は同色の紙同士なので見えない)
//   3. 墨入れ  … 次の画面の墨が浮き上がって据わる(focus のたびに流れるので、
//                進んで来ても、戻って来ても、同じ所作で迎えられる)
//
//   - 跳ね・バウンスは使わない(閉じ際演出と同系統の緩やかな ease)
//   - 地・固定フッター・grain はこの中に入れない(紙は動かさない)
//   - 端末の「アニメーションを無効化」では流さず、最終状態を即時表示する

import { useCallback, useMemo, type ReactNode } from 'react';
import { AccessibilityInfo, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, {
  Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';

// マウントと同じフレームで判定が要るため、モジュール読み込み時から先読みしておく。
// lib/use-reduce-motion.ts はフックの初期値が false で、初回マウントには間に合わない。
let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => { reduceMotion = v; })
  .catch(() => { /* 取れんときは演出する(既定) */ });
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => { reduceMotion = v; });

// 墨入れ(入場)。浮き上がりは気配より半歩だけ強く、時間は障子(1200ms)より短い側に置く
const RISE = 12;
const ENTER_MS = 380;
// 筆を引く(退場)。入場より速く畳む ── タップへの応えは動き出しの速さで示す
const WITHDRAW_MS = 160;
const ease = Easing.out(Easing.cubic);

// いま前面にある画面の墨。「筆を引く」相手は常にこの1枚だけ。
// blur の後始末は自分が前面のときに限る(push 直後は次の画面がもう据わっている)
let focusedInk: SharedValue<number> | null = null;
// 連打・二度押しで遷移が重ならないための札
let navigating = false;

/** いまの画面の墨を沈めてから action(遷移)を実行する。墨が無ければ即座に実行 */
function withdrawThen(action: () => void) {
  if (navigating) return;
  const ink = focusedInk;
  if (!ink || reduceMotion) {
    action();
    return;
  }
  navigating = true;
  const done = () => {
    navigating = false;
    action();
  };
  ink.value = withTiming(0, { duration: WITHDRAW_MS, easing: ease }, () => {
    'worklet';
    runOnJS(done)();
  });
}

type AppRouter = ReturnType<typeof useRouter>;

/**
 * 「筆を引いてから移る」ルーター。画面遷移は router を直接叩かず、これを通す。
 * 端末の戻るボタン等、ここを通らない遷移でも墨入れ(focus 側)は流れる。
 */
export function useSumiireRouter() {
  const router = useRouter();
  return useMemo(
    () => ({
      push: (href: Parameters<AppRouter['push']>[0]) => withdrawThen(() => router.push(href)),
      navigate: (href: Parameters<AppRouter['navigate']>[0]) =>
        withdrawThen(() => router.navigate(href)),
      replace: (href: Parameters<AppRouter['replace']>[0]) =>
        withdrawThen(() => router.replace(href)),
      back: () => withdrawThen(() => router.back()),
    }),
    [router],
  );
}

export function Sumiire({ style, children }: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  // 0=沈んだ状態(下に12px・透明) 〜 1=据わり。無効化設定では最初から据わった状態
  const settle = useSharedValue(reduceMotion ? 1 : 0);

  // 入場は focus のたびに流す。push で来たときも、筆を引いて(=墨が0のまま
  // 下で待っていた画面へ)戻って来たときも、同じ所作で墨が入る。
  // すでに据わっている(=1)ときの withTiming は何も動かさないので二重には流れない
  useFocusEffect(
    useCallback(() => {
      focusedInk = settle;
      if (reduceMotion) {
        settle.value = 1;
      } else {
        settle.value = withTiming(1, { duration: ENTER_MS, easing: ease });
      }
      return () => {
        if (focusedInk === settle) focusedInk = null;
      };
    }, [settle]),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: settle.value,
    transform: [{ translateY: (1 - settle.value) * RISE }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
