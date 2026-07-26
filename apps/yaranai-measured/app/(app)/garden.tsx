// 庭モード(絵巻)。週の節目(土曜・日曜の暦日)にのみ開く(§5.2)。祝日は対象外。
// 開発者モードは曜日に関わらず365日開く(実測・高水位には触れず、ホームの
// スライダー値をルートパラメータで受け取ってその場で組む)。
// 退出は明示的な「とじる」のみ。自動で閉じない・自動遷移しない。

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSession, colors, fonts } from '@yaranai/core';

import { GardenScroll } from '../../components/garden/GardenScroll';
import { buildGrowthFromDebug, loadGrowth } from '../../components/garden/load';
import { isEngawaOpen } from '../../lib/garden/gate';
import { useIsDeveloper } from '../../lib/developer';
import { useT } from '../../lib/i18n/context';
import { MOSS_FULL_HOURS, type GrowthParams } from '../../lib/garden/growth';

export default function GardenMode() {
  const session = useSession();
  const isDeveloper = useIsDeveloper();
  const router = useRouter();
  const t = useT();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ days?: string; hours?: string }>();
  const [growth, setGrowth] = useState<GrowthParams | null>(null);
  // 開発者モードは週末に限らず365日開く。本番は週の節目(土曜・日曜)のみ
  const open = isDeveloper || isEngawaOpen(new Date());

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
    if (session && open && !isDeveloper) loadGrowth(session.user.id).then(setGrowth);
  }, [session, open, isDeveloper]);

  // 開発者モード(§2): ホームのスライダー値をパラメータで受け取り、その場で組む。
  // パラメータ無しで開かれたときは DevGarden の初期値と同じ既定で描く
  const devGrowth = useMemo(() => {
    if (!isDeveloper) return null;
    const days = Number(params.days);
    const hours = Number(params.hours);
    return buildGrowthFromDebug(
      Number.isFinite(days) ? days : 42,
      Number.isFinite(hours) ? hours : Math.round(MOSS_FULL_HOURS / 2),
    );
  }, [isDeveloper, params.days, params.hours]);

  if (!open) return <Redirect href="/(app)" />;
  const shown = isDeveloper ? devGrowth : growth;

  return (
    <Animated.View style={[styles.container, appearStyle]}>
      {shown && <GardenScroll growth={shown} />}
      <Pressable
        style={[styles.close, { top: insets.top + 12 }]}
        hitSlop={16}
        onPress={() => router.back()}
      >
        <Text style={styles.closeText}>{t.garden.close}</Text>
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
