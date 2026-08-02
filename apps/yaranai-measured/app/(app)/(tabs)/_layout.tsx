// フッター3タブ(庭 / 読みもの / 言い訳カード)の遷移「木漏れ日フェード」。
//
// 二層構成(スペック §2):
//   1. ベース: bottom-tabs 7 の TransitionPresets.FadeTransition によるクロスフェード。
//      3画面とも同じ生成りの地を敷いているので、紙は動かず墨だけが入れ替わって見える。
//      下地は親 Stack の contentStyle(生成り)が敷いており、フェード中間で両画面の
//      不透明度が下がっても無地・白・黒のフレームは挟まらない
//   2. 味付け: フェード中に画面全体の明度がほんのわずかに上がって戻る「木漏れ日」
//      レイヤー(光が一瞬差して引く感覚)。色は庭の光だまりと同一トークン
//
// 遷移とレイヤーは並行して走らせる ── 「アニメ完了を待ってから navigate」の直列制御は
// しない(黒フラッシュの原因になる)。フッターの見た目は各画面が持つ AppFooter のまま
// (3画面で同一の帯なので、クロスフェードしても帯は動いて見えない)。
//
// スタック遷移(宣言・誓い詳細・時間の行き先など)・close ritual・起動スプラッシュは
// このレイヤーの対象外。数値の調整は lib/transitions/constants.ts だけで行う。

import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import { TransitionPresets } from '@react-navigation/bottom-tabs';
import Animated, {
  useAnimatedStyle, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated';
import { colors } from '@yaranai/core';
import { useReduceMotion } from '../../../lib/use-reduce-motion';
import {
  KOMOREBI_COLOR,
  KOMOREBI_FALL_EASING,
  KOMOREBI_FALL_MS,
  KOMOREBI_PEAK_OPACITY,
  KOMOREBI_RISE_EASING,
  KOMOREBI_RISE_MS,
  TAB_FADE_DURATION_MS,
  TAB_FADE_EASING,
} from '../../../lib/transitions/constants';

export const unstable_settings = { initialRouteName: 'index' };

// タブ3画面の pathname。ここに含まれる同士の移動だけが「タブ間の遷移」で、
// スタック遷移(例: '/' → '/declare' や '/reading' → '/reading/xxx')では
// 木漏れ日を発火させない。同じタブの再タップは pathname が変わらないので素通り
const TAB_PATHS = new Set(['/', '/reading', '/excuse']);

export default function TabsLayout() {
  const pathname = usePathname();
  const reduceMotion = useReduceMotion();

  // 0(透明)〜 KOMOREBI_PEAK_OPACITY。タブ切替のたびに 差して→引く の一往復
  const glow = useSharedValue(0);
  const prevPath = useRef(pathname);

  useEffect(() => {
    const from = prevPath.current;
    prevPath.current = pathname;
    if (from === pathname) return;
    if (!TAB_PATHS.has(from) || !TAB_PATHS.has(pathname)) return;
    if (reduceMotion) return;
    // 連打で再生中に切り替わっても 0 へ戻さず、現在値からピークへ向かう
    // (値のジャンプによるチラつきを出さない)
    glow.value = withSequence(
      withTiming(KOMOREBI_PEAK_OPACITY, { duration: KOMOREBI_RISE_MS, easing: KOMOREBI_RISE_EASING }),
      withTiming(0, { duration: KOMOREBI_FALL_MS, easing: KOMOREBI_FALL_EASING }),
    );
  }, [pathname, reduceMotion, glow]);

  // 待機中(opacity 0)は display: 'none' 相当に落として描画コストを出さない
  const komorebiStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    display: glow.value === 0 ? ('none' as const) : ('flex' as const),
  }));

  return (
    <View style={styles.root}>
      <Tabs
        // フッターは各画面の AppFooter(紙の帯)が担うので、標準のタブバーは出さない
        tabBar={() => null}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.kinari },
          // 端末の「アニメーションを無効化」ではフェードを流さず即時切替
          ...(reduceMotion
            ? null
            : {
                ...TransitionPresets.FadeTransition,
                transitionSpec: {
                  animation: 'timing',
                  config: { duration: TAB_FADE_DURATION_MS, easing: TAB_FADE_EASING },
                },
              }),
        }}
      />

      {/* 木漏れ日レイヤー。最上層・全面・タップは一切奪わない */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, styles.komorebi, komorebiStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.kinari },
  komorebi: { backgroundColor: KOMOREBI_COLOR },
});
