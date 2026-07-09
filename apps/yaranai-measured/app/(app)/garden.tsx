// 庭モード(絵巻)。週の節目(日曜の暦日)にのみ開く(§5.2)。
// 退出は明示的な「とじる」のみ。自動で閉じない・自動遷移しない。

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSession, colors, fonts } from '@yaranai/core';

import { GardenScroll } from '../../components/garden/GardenScroll';
import { loadGrowth } from '../../components/garden/load';
import { isEngawaOpen } from '../../lib/garden/gate';
import { useIsDeveloper } from '../../lib/developer';
import type { GrowthParams } from '../../lib/garden/growth';

export default function GardenMode() {
  const session = useSession();
  const isDeveloper = useIsDeveloper();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [growth, setGrowth] = useState<GrowthParams | null>(null);
  const open = isEngawaOpen(new Date());

  // 控えめなフェード+わずかなスケール(§5.3)
  const appear = useSharedValue(0);
  useEffect(() => {
    appear.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) });
  }, [appear]);
  const appearStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: 0.985 + 0.015 * appear.value }],
  }));

  useEffect(() => {
    // 開発者モード(§3): loadGrowth を呼ばない(高水位の読み書きで本番マークを汚さない)。
    // デバッグの庭確認はホームのスライダーUIで行う。
    if (session && open && !isDeveloper) loadGrowth(session.user.id).then(setGrowth);
  }, [session, open, isDeveloper]);

  // 開発者モードでは絵巻モードへ入らない(実測・高水位に触れないため)
  if (isDeveloper) return <Redirect href="/(app)" />;
  if (!open) return <Redirect href="/(app)" />;

  return (
    <Animated.View style={[styles.container, appearStyle]}>
      {growth && <GardenScroll growth={growth} />}
      <Pressable
        style={[styles.close, { top: insets.top + 12 }]}
        hitSlop={16}
        onPress={() => router.back()}
      >
        <Text style={styles.closeText}>とじる</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.kinari },
  close: {
    position: 'absolute',
    right: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  closeText: {
    fontFamily: fonts.serif,
    fontSize: 13,
    letterSpacing: 4,
    color: colors.sumi,
    opacity: 0.72,
  },
});
