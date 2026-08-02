// 世界観導入(オンボーディング §1)。初回起動の1枚。文言は仮(別途支給)。
// 右上に「とばす」(薄墨・小さく)。スキップしても以降のフローは同一で、
// どちらの道でもこの画面は二度と出ない(worldview_seen)。
// 煽り・カウントダウン・FOMO表現は入れない(五原則)。

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts } from '@yaranai/core';
import { useT } from '../../lib/i18n/context';
import { Sumiire, useSumiireRouter } from '../../components/Sumiire';
import { markWorldviewSeen } from '../../lib/onboarding';

export default function Worldview() {
  const router = useSumiireRouter();
  const t = useT();

  // とばす も すすむ も行き先は同じサインアップ。差は所作の速さだけ
  const proceed = async () => {
    await markWorldviewSeen();
    router.replace({ pathname: '/(auth)/sign-in', params: { mode: 'signup' } });
  };

  return (
    <Sumiire style={styles.container}>
      <Pressable style={styles.skip} hitSlop={12} accessibilityRole="button" onPress={proceed}>
        <Text style={styles.skipText}>{t.worldview.skip}</Text>
      </Pressable>

      <View style={styles.body}>
        <Text style={styles.wordmark}>Yaranai</Text>
        <Text style={styles.lede}>{t.worldview.lede}</Text>
        <Text style={styles.worldview}>{t.worldview.body}</Text>
      </View>

      <Pressable style={styles.next} onPress={proceed}>
        <Text style={styles.nextText}>{t.worldview.next}</Text>
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
  skip: {
    position: 'absolute',
    top: 64,
    right: 28,
    minHeight: 44,
    justifyContent: 'center',
  },
  skipText: { fontFamily: fonts.serif, fontSize: 12, color: colors.usuzumi, letterSpacing: 3 },
  body: { alignItems: 'center', gap: 40 },
  wordmark: {
    fontFamily: fonts.serif,
    fontSize: 22,
    letterSpacing: 8,
    color: colors.sumi,
    textAlign: 'center',
  },
  lede: {
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 36,
    letterSpacing: 2,
    color: colors.sumi,
    textAlign: 'center',
  },
  worldview: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 32,
    letterSpacing: 2,
    color: colors.usuzumi,
    textAlign: 'center',
  },
  next: { marginTop: 64, paddingVertical: 12, alignItems: 'center' },
  nextText: { fontFamily: fonts.serif, fontSize: 15, color: colors.sumi, letterSpacing: 6 },
});
