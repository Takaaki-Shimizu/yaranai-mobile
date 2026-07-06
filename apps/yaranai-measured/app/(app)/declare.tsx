import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSession, colors, fonts } from '@yaranai/core';
import { supabase } from '../../lib/supabase';
import { computeBaseline, type BaselineResult, BASELINE_MIN_DAYS } from '../../lib/baseline';
import { formatMinutes } from '../../lib/format';

export default function Declare() {
  const session = useSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ packageName?: string; label?: string }>();
  const packageName = typeof params.packageName === 'string' ? params.packageName : '';
  const label = typeof params.label === 'string' ? params.label : packageName;

  const [baseline, setBaseline] = useState<BaselineResult | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

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
      // アクティブ3本超過はDBトリガーが止める
      if (error.message.includes('手元におけるのは最大3つまで')) {
        setMessage('手元におけるのは、3つまでです。');
      } else {
        setMessage('宣言できませんでした。もう一度お試しください。');
      }
      return;
    }
    router.replace('/(app)');
  };

  if (!packageName) {
    return (
      <View style={styles.container}>
        <Text style={styles.description}>アプリは、観測の一覧から選んでください。</Text>
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>戻る</Text>
        </Pressable>
      </View>
    );
  }

  // 履歴が28日に満たない間は宣言できない(機種変更直後など)
  if (baseline && baseline.status === 'insufficient') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>ふだんの記録を集めています</Text>
        <Text style={styles.description}>
          この端末の記録が{BASELINE_MIN_DAYS}日ぶんに満ちると、宣言できるようになります。{'\n'}
          いまは{baseline.availableDays}日ぶんです。
        </Text>
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>戻る</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>やらない、を宣言する。</Text>

      <View style={styles.form}>
        <Text style={styles.appLabel}>{label}</Text>

        {baseline?.status === 'ok' && (
          <Text style={styles.baseline}>
            あなたはこの{Math.round(baseline.windowDays / 7)}週、{'\n'}
            1日平均{formatMinutes(baseline.averageMinutesPerDay)}を{'\n'}
            このアプリに渡していました。
          </Text>
        )}

        <Text style={styles.note}>
          この平均が、あなたの「ふだん」として固定されます。{'\n'}
          ふだんより使わなかったぶんだけ、時間が戻ります。
        </Text>

        <Pressable
          style={styles.primary}
          onPress={declare}
          disabled={busy || baseline?.status !== 'ok'}
        >
          <Text style={styles.primaryText}>宣言する</Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>戻る</Text>
        </Pressable>

        {message !== '' && <Text style={styles.message}>{message}</Text>}
      </View>
    </View>
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
});
