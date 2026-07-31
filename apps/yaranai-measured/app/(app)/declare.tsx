import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSession, colors, fonts } from '@yaranai/core';
import { Sumiire, useSumiireRouter } from '../../components/Sumiire';
import { supabase } from '../../lib/supabase';
import { computeBaseline, type BaselineResult, BASELINE_MIN_DAYS } from '../../lib/baseline';
import { formatMinutes } from '../../lib/format';
import { useLang, useT } from '../../lib/i18n/context';

export default function Declare() {
  const session = useSession();
  const router = useSumiireRouter();
  const { lang } = useLang();
  const t = useT();
  const params = useLocalSearchParams<{ packageName?: string; label?: string }>();
  const packageName = typeof params.packageName === 'string' ? params.packageName : '';
  const label = typeof params.label === 'string' ? params.label : packageName;

  const [baseline, setBaseline] = useState<BaselineResult | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // 基準線は宣言時スナップショット。この画面で見た平均が、そのまま固定される。
  useEffect(() => {
    if (packageName) setBaseline(computeBaseline(packageName));
  }, [packageName]);

  const declare = async () => {
    if (!session || !packageName || baseline?.status !== 'ok') return;
    setBusy(true);
    setMessage('');
    const { error } = await supabase.from('measured_vows').insert({
      user_id: session.user.id,
      package_name: packageName,
      app_label: label,
      baseline_minutes: baseline.averageMinutesPerDay,
      baseline_window_days: baseline.windowDays,
    });
    setBusy(false);

    if (error) {
      // アクティブ3本超過はDBトリガーが止める(DB側のメッセージは日本語固定)
      if (error.message.includes('手元におけるのは最大3つまで')) {
        setMessage(t.declare.limitReached);
      } else {
        setMessage(t.declare.failed);
      }
      return;
    }
    // 宣言の完了。世界観の一文を添えた完了画面を挟んでから庭へ戻る(§変更5)
    setDone(true);
  };

  // 宣言(断つ)の儀式の完了画面。
  // どの分岐もルートは同型の Sumiire(墨入れ)なので、分岐が切り替わっても
  // 再マウントされず、入場はこの画面へ来た一度きりしか流れない
  if (done) {
    return (
      <Sumiire style={styles.container}>
        <View style={styles.doneBody}>
          <Text style={styles.doneLede}>{t.declare.doneLede(label)}</Text>
          <Text style={styles.worldview}>{t.declare.doneWorldview}</Text>
          {/* 言い訳カードの告知(言い訳カード §4.4)。世界観の語りの後に一行だけ。
              タップで言い訳カードのタブへ入る。タップ可能であることを示す装飾
              (下線・矢印・ボタン枠)は付けない。告知はこの1箇所のみ */}
          <Pressable onPress={() => router.push('/(app)/excuse')}>
            <Text style={styles.worldview}>{t.declare.doneExcuseHint}</Text>
          </Pressable>
          <Pressable style={styles.doneAction} onPress={() => router.replace('/(app)')}>
            <Text style={styles.doneActionText}>{t.declare.toGarden}</Text>
          </Pressable>
        </View>
      </Sumiire>
    );
  }

  if (!packageName) {
    return (
      <Sumiire style={styles.container}>
        <Text style={styles.description}>{t.declare.pickFromObserve}</Text>
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>{t.declare.back}</Text>
        </Pressable>
      </Sumiire>
    );
  }

  // 履歴が28日に満たない間は宣言できない(機種変更直後など)
  if (baseline && baseline.status === 'insufficient') {
    return (
      <Sumiire style={styles.container}>
        <Text style={styles.title}>{t.declare.gatheringTitle}</Text>
        <Text style={styles.description}>
          {t.declare.gatheringBody(BASELINE_MIN_DAYS, baseline.availableDays)}
        </Text>
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>{t.declare.back}</Text>
        </Pressable>
      </Sumiire>
    );
  }

  return (
    <Sumiire style={styles.container}>
      <Text style={styles.title}>{t.declare.title}</Text>

      <View style={styles.form}>
        <Text style={styles.appLabel}>{label}</Text>

        {baseline?.status === 'ok' && (
          <Text style={styles.baseline}>
            {t.declare.baseline(
              Math.round(baseline.windowDays / 7),
              formatMinutes(baseline.averageMinutesPerDay, lang),
            )}
          </Text>
        )}

        <Text style={styles.note}>{t.declare.note}</Text>

        <Pressable
          style={styles.primary}
          onPress={declare}
          disabled={busy || baseline?.status !== 'ok'}
        >
          <Text style={styles.primaryText}>{t.declare.declare}</Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>{t.declare.back}</Text>
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
  title: {
    fontFamily: fonts.serif,
    fontSize: 20,
    letterSpacing: 4,
    color: colors.sumi,
    textAlign: 'center',
    marginBottom: 40,
  },
  form: { gap: 20 },
  appLabel: {
    fontFamily: fonts.serif,
    fontSize: 17,
    letterSpacing: 2,
    color: colors.sumi,
    textAlign: 'center',
  },
  baseline: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 32,
    letterSpacing: 1,
    color: colors.sumi,
    textAlign: 'center',
  },
  description: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 30,
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

  // 宣言完了画面(§変更5)。世界観の語りと同じ体裁: 明朝・中央寄せ・余白多め
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
