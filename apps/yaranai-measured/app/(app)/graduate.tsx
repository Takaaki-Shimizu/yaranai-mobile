import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors, fonts } from '@yaranai/core';
import { Sumiire, useSumiireRouter } from '../../components/Sumiire';
import { supabase } from '../../lib/supabase';
import { getTodayTokyoDate } from '../../lib/dates';
import { isGraduable } from '../../lib/graduation-check';
import { useT } from '../../lib/i18n/context';

// 卒業の儀式(卒業機能 §5-2)。宣言(declare.tsx)と同じ二拍 ── 確認 → 完了画面。
//
// この画面へは、ホームで卒業条件が成立した誓いからしか入れない。促す文言も
// バッジも通知も無い(五原則1)。ここでできるのは「卒業する」だけで、
// 挑戦中の誓いを外す道はこの画面にも、どこにも無い。
export default function Graduate() {
  const router = useSumiireRouter();
  const t = useT();
  const params = useLocalSearchParams<{ vowId?: string; label?: string; packageName?: string }>();
  const vowId = typeof params.vowId === 'string' ? params.vowId : '';
  const packageName = typeof params.packageName === 'string' ? params.packageName : '';
  const label = typeof params.label === 'string' ? params.label : packageName;

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // 入口が無い状態(直リンク・パラメータ落ち)では黙って庭へ還す。
  useEffect(() => {
    if (!vowId || !packageName) router.replace('/(app)/(tabs)');
  }, [vowId, packageName, router]);

  // 卒業条件をもう一度、端末内DBから評価する。窓は前日までの7暦日やけん、
  // 当日の使用では崩れん。崩れうるのは、日付が変わって窓がずれた場合や、
  // 同期で過去日が埋まった場合(競合状態)。そのときは何も言わず庭へ戻す。
  const graduate = async () => {
    if (busy || !vowId || !packageName) return;
    setBusy(true);
    setMessage('');

    if (!(await isGraduable(packageName))) {
      setBusy(false);
      router.replace('/(app)/(tabs)');
      return;
    }

    // 卒業 = graduated_on を立てるだけ。discontinued_on には触れんけん、
    // 同期も取り戻しのカウントもこのまま続く(五原則の「消えない蓄積」)。
    const { error } = await supabase
      .from('measured_vows')
      .update({ graduated_on: getTodayTokyoDate() })
      .eq('id', vowId);
    setBusy(false);

    if (error) {
      setMessage(t.graduate.failed);
      return;
    }
    setDone(true);
  };

  // 卒業の完了画面。宣言の完了画面と同じ体裁(明朝・中央寄せ・余白多め)。
  // どの分岐もルートは同型の Sumiire(墨入れ)なので、切り替えで再マウントされない。
  if (done) {
    return (
      <Sumiire style={styles.container}>
        <View style={styles.doneBody}>
          <Text style={styles.doneLede}>{t.graduate.doneLede(label)}</Text>
          <Text style={styles.worldview}>{t.graduate.doneWorldview}</Text>
          <Pressable style={styles.doneAction} onPress={() => router.replace('/(app)/(tabs)')}>
            <Text style={styles.doneActionText}>{t.graduate.toGarden}</Text>
          </Pressable>
        </View>
      </Sumiire>
    );
  }

  return (
    <Sumiire style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.lede}>{t.graduate.lede(label)}</Text>
        <Text style={styles.note}>{t.graduate.note}</Text>

        <Pressable style={styles.primary} onPress={graduate} disabled={busy}>
          <Text style={styles.primaryText}>{t.graduate.graduate}</Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>{t.graduate.back}</Text>
        </Pressable>

        {message !== '' && <Text style={styles.message}>{message}</Text>}
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
  form: { gap: 20 },
  lede: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 32,
    letterSpacing: 1,
    color: colors.sumi,
    textAlign: 'center',
  },
  note: {
    fontSize: 12,
    lineHeight: 22,
    color: colors.usuzumi,
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
  secondary: { paddingVertical: 10, alignItems: 'center' },
  secondaryText: { fontFamily: fonts.serif, fontSize: 13, color: colors.usuzumi, letterSpacing: 3 },
  message: { color: colors.shu, fontSize: 12, textAlign: 'center', marginTop: 8 },

  doneBody: { alignItems: 'center', gap: 40 },
  doneLede: {
    fontFamily: fonts.serif,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.sumi,
    textAlign: 'center',
  },
  worldview: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 34,
    letterSpacing: 2,
    color: colors.sumi,
    textAlign: 'center',
  },
  doneAction: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center' },
  doneActionText: { fontFamily: fonts.serif, fontSize: 15, color: colors.sumi, letterSpacing: 6 },
});
