import { useCallback, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Garden, useSession, colors, fonts } from '@yaranai/core';
import { supabase } from '../../lib/supabase';
import { syncAll } from '../../lib/usage-sync';
import { hasUsageAccess, isUsageStatsAvailable } from '../../modules/usage-stats';

type VowSummary = {
  vow_id: string;
  app_label: string;
  baseline_minutes: number;
  saved_hours: number;
  measured_days: number;
};

type Totals = {
  total_saved_hours: number;
  longest_days: number;
  phase: number;
};

export default function Home() {
  const session = useSession();
  const router = useRouter();
  const [vows, setVows] = useState<VowSummary[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    const [totalsRes, vowsRes] = await Promise.all([
      supabase.from('garden_state').select('*').maybeSingle(),
      supabase
        .from('measured_saved')
        .select('vow_id, app_label, baseline_minutes, saved_hours, measured_days')
        .is('discontinued_on', null)
        .order('declared_on', { ascending: true }),
    ]);
    setTotals(totalsRes.data ?? null);
    setVows(vowsRes.data ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      // 許可がなければ、まず許可の画面へ
      if (!isUsageStatsAvailable || !hasUsageAccess()) {
        router.replace('/(app)/permission');
        return;
      }
      loadAll();
    }, [loadAll, router])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    if (session) await syncAll(session.user.id);
    await loadAll();
    setRefreshing(false);
  };

  const phase = totals?.phase ?? 0.05;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.wordmark}>Yaranai</Text>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOut}>退出</Text>
        </Pressable>
      </View>

      {/* 蓄積 */}
      <View style={styles.garden}>
        {totals && totals.total_saved_hours > 0 ? (
          <>
            <Text style={styles.headline}>
              {totals.longest_days}日で、{totals.total_saved_hours}時間が{'\n'}戻ってきました。
            </Text>
            <View style={{ marginTop: 32, width: '100%' }}>
              <Garden phase={phase} />
            </View>
          </>
        ) : (
          <Text style={styles.headline}>ここから、始まる。</Text>
        )}
      </View>

      {/* 誓い */}
      <View style={styles.list}>
        {vows.map((vow) => (
          <View key={vow.vow_id} style={styles.row}>
            <View style={styles.rowHead}>
              <Text style={styles.label}>{vow.app_label}</Text>
              <Text style={styles.minutes}>基準線 {Math.round(vow.baseline_minutes)}分/日</Text>
            </View>
            <Text style={styles.saved}>
              {vow.measured_days > 0
                ? `${vow.measured_days}日の実測で、${vow.saved_hours}時間。`
                : '実測を待っています。'}
            </Text>
          </View>
        ))}

        <Pressable style={styles.observe} onPress={() => router.push('/(app)/observe')}>
          <Text style={styles.observeText}>時間の行き先を見る</Text>
        </Pressable>
      </View>

      <Text style={styles.footnote}>基準線を超えた日も、庭は縮まない。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.kinari },
  content: { paddingHorizontal: 28, paddingTop: 64, paddingBottom: 80 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  wordmark: { fontFamily: fonts.serif, fontSize: 16, letterSpacing: 6, color: colors.sumi },
  signOut: { fontSize: 11, color: colors.usuzumi, letterSpacing: 2 },

  garden: { paddingVertical: 72, alignItems: 'center' },
  headline: {
    fontFamily: fonts.serif,
    fontSize: 22,
    lineHeight: 40,
    letterSpacing: 2,
    color: colors.sumi,
    textAlign: 'center',
  },
  list: { gap: 28 },
  row: { gap: 8 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontFamily: fonts.serif, fontSize: 17, color: colors.sumi, letterSpacing: 1 },
  minutes: { fontSize: 11, color: colors.usuzumi },
  saved: { fontSize: 12, color: colors.usuzumi, letterSpacing: 1 },

  observe: {
    marginTop: 8,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.usuzumi,
    borderStyle: 'dashed',
  },
  observeText: { fontFamily: fonts.serif, fontSize: 14, color: colors.sumi, letterSpacing: 4 },

  footnote: {
    marginTop: 56,
    textAlign: 'center',
    fontSize: 11,
    color: colors.usuzumi,
    letterSpacing: 2,
  },
});
