// 画面遷移の所作「墨入れ」。全画面が同じ生成りの地を敷いているため、画面の切替は
// 「紙の差し替え」ではなく「同じ紙の上で墨が入れ替わる」ものとして扱う。
// Stack 側の控えめなフェード(紙の入れ替わりを消す)に重ねて、内容(墨)だけが
// わずかに浮き上がって据わる。地・固定フッター・grain はこの中に入れない。
//
//   - 跳ね・バウンスは使わない(閉じ際演出と同系統の緩やかな ease)
//   - 流れるのはマウントの一度きり。画面内の状態分岐や focus 復帰では流さない
//     (どの分岐でも画面の同じ位置に置けば、再マウントされず再生もされない)
//   - 端末の「アニメーションを無効化」では流さず、最終状態を即時表示する

import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';

// マウントと同じフレームで判定が要るため、モジュール読み込み時から先読みしておく。
// lib/use-reduce-motion.ts はフックの初期値が false で、初回マウントには間に合わない。
let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => { reduceMotion = v; })
  .catch(() => { /* 取れんときは演出する(既定) */ });
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => { reduceMotion = v; });

// 浮き上がりは気配だけにとどめる。時間と ease は庭の入場(garden §5.3)と同系統
const RISE = 10;
const DURATION = 300;
const ease = Easing.out(Easing.cubic);

export function Sumiire({ style, children }: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  // 0=入り始め(下に10px・透明) 〜 1=据わり。無効化設定では最初から据わった状態
  const settle = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    settle.value = withTiming(1, { duration: DURATION, easing: ease });
  }, [settle]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: settle.value,
    transform: [{ translateY: (1 - settle.value) * RISE }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
