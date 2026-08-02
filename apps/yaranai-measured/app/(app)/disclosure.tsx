// 目立つ開示(オンボーディング §4)。使用状況アクセスを求める前に、
// どのデータ(アプリごとの利用時間統計)を何のため(基準線の算出と取り戻し時間の計測)に
// 読むか、外に出る範囲はどこまでか(誓い対象の日次合計と基準線だけ)を先に示す。
// Playの目立つ開示要件を満たす画面で、トーンは permission.tsx の文体に揃える。

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts } from '@yaranai/core';
import { useT } from '../../lib/i18n/context';
import { Sumiire, useSumiireRouter } from '../../components/Sumiire';
import { markDisclosureSeen } from '../../lib/onboarding';

export default function Disclosure() {
  const router = useSumiireRouter();
  const t = useT();

  // 「わかった」の印を置いてから [E] へ。再起動時は [E] から再開する(§7)
  const proceed = async () => {
    await markDisclosureSeen();
    router.push('/(app)/permission');
  };

  return (
    <Sumiire style={styles.container}>
      <Text style={styles.wordmark}>Yaranai</Text>

      <View style={styles.form}>
        <Text style={styles.body}>{t.disclosure.what}</Text>
        <Text style={styles.note}>{t.disclosure.boundary}</Text>

        <Pressable style={styles.primary} onPress={proceed}>
          <Text style={styles.primaryText}>{t.disclosure.action}</Text>
        </Pressable>
      </View>
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
  wordmark: {
    fontFamily: fonts.serif,
    fontSize: 22,
    letterSpacing: 8,
    color: colors.sumi,
    textAlign: 'center',
    marginBottom: 48,
  },
  form: { gap: 20 },
  body: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 32,
    letterSpacing: 1,
    color: colors.sumi,
    textAlign: 'center',
  },
  note: {
    color: colors.usuzumi,
    fontSize: 13,
    lineHeight: 24,
    textAlign: 'center',
  },
  primary: {
    marginTop: 28,
    backgroundColor: colors.shu,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    fontFamily: fonts.serif,
    color: colors.kinari,
    fontSize: 16,
    letterSpacing: 6,
  },
});
