// 待機モード(オンボーディング §5・例外系③)。
// 端末セットアップから28日未満の端末を使う新規ユーザーだけが通る。
// 世界観トーンのテキスト一枚。「あと◯日」のカウントダウン表現はしない(五原則)。
// この画面を抜けた時点でオンボーディングは「完了」扱いとし、ホームへ。
// 28日に達した起動でホームが時間の行き先([F])へ誘導する。

import { Text, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSession, colors, fonts } from '@yaranai/core';
import { useT } from '../../lib/i18n/context';
import { Sumiire, useSumiireRouter } from '../../components/Sumiire';
import { markOnboardingDone, setWaitingMode } from '../../lib/onboarding';

export default function Waiting() {
  const session = useSession();
  const router = useSumiireRouter();
  const t = useT();
  const params = useLocalSearchParams<{ days?: string }>();
  // 「いま◯日目」。記録0日でも「0日目」とは言わん(集め始めた当日が1日目)
  const days = Math.max(1, Number(params.days ?? '1') || 1);

  const proceed = async () => {
    if (session) {
      await setWaitingMode(session.user.id);
      await markOnboardingDone(session.user.id);
    }
    router.replace('/(app)/(tabs)');
  };

  return (
    <Sumiire style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.worldview}>{t.waiting.body(days)}</Text>
        <Text style={styles.note}>{t.waiting.note}</Text>
      </View>

      <Pressable style={styles.action} onPress={proceed}>
        <Text style={styles.actionText}>{t.waiting.proceed}</Text>
      </Pressable>
    </Sumiire>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.kinari,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  body: { alignItems: 'center', gap: 28 },
  worldview: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 34,
    letterSpacing: 2,
    color: colors.sumi,
    textAlign: 'center',
  },
  note: {
    fontFamily: fonts.serif,
    fontSize: 14,
    lineHeight: 28,
    letterSpacing: 1,
    color: colors.usuzumi,
    textAlign: 'center',
  },
  action: { marginTop: 64, paddingVertical: 12, alignItems: 'center' },
  actionText: { fontFamily: fonts.serif, fontSize: 15, color: colors.sumi, letterSpacing: 6 },
});
