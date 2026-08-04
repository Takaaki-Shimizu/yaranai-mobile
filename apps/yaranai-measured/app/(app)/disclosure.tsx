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

        {/* 記録が入る仕組み(記録欠落の開示 §3-1a)。7日を超えて開かんかった期間の記録は
            端末にもサーバーにも残らん ── 補正せんと決めた仕様やけん、宣言の手前で先に伝える。
            注意書きの体裁(アイコン・枠線・警告色)は使わず、開くことも求めない。
            最後の一行は独立した段落にする: 受け取れん日の話にくっつけると、
            「減らない」がそこに飲まれて読み落とされる */}
        <View style={styles.gap}>
          <Text style={styles.gapTitle}>{t.disclosure.recordGapTitle}</Text>
          <Text style={styles.note}>{t.disclosure.recordGapBody}</Text>
          <Text style={styles.note}>{t.disclosure.recordGapKeep}</Text>
        </View>

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
  // 段落どうしの間だけで区切る。枠線も背景色も敷かない(注意書きにしないため)
  gap: { gap: 14 },
  gapTitle: {
    fontFamily: fonts.serif,
    fontSize: 14,
    lineHeight: 26,
    letterSpacing: 1,
    color: colors.sumi,
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
