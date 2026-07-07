import { useCallback, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Garden, useSession, colors, fonts } from '@yaranai/core';
import { supabase } from '../../lib/supabase';
import { syncAll } from '../../lib/usage-sync';
import { recordDateDaysAgo } from '../../lib/dates';
import { formatMinutes } from '../../lib/format';
import { hasUsageAccess, isUsageStatsAvailable } from '../../modules/usage-stats';

type VowSummary = {
  vow_id: string;
  app_label: string;
  baseline_minutes: number;
  saved_minutes: number;
  discontinued_on: string | null;
};

type Totals = {
  longest_days: number;
  phase: number;
};

export default function Home() {
  const session = useSession();
  const router = useRouter();
  const [vows, setVows] = useState<VowSummary[]>([]);
  const [totalSavedMinutes, setTotalSavedMinutes] = useState(0);
  const [yesterdayMinutes, setYesterdayMinutes] = useState<Map<string, number>>(new Map());
  const [totals, setTotals] = useState<Totals | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    // 累計はやめた誓いも含めた全体。行の表示はアクティブな誓いだけ。
    const [totalsRes, vowsRes, dailyRes] = await Promise.all([
      supabase.from('garden_state').select('longest_days, phase').maybeSingle(),
      supabase
        .from('measured_saved')
        .select('vow_id, app_label, baseline_minutes, saved_minutes, discontinued_on')
        .order('declared_on', { ascending: true }),
      supabase
        .from('measured_daily')
        .select('vow_id, actual_minutes')
        .eq('record_date', recordDateDaysAgo(1)),
    ]);
    const allVows = (vowsRes.data ?? []) as VowSummary[];
    setTotals(totalsRes.data ?? null);
    setVows(allVows.filter((v) => v.discontinued_on === null));
    setTotalSavedMinutes(allVows.reduce((sum, v) => sum + v.saved_minutes, 0));
    setYesterdayMinutes(
      new Map((dailyRes.data ?? []).map((d) => [d.vow_id as string, d.actual_minutes as number])),
    );
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
        {totals && Math.round(totalSavedMinutes) > 0 ? (
          <>
            <Text style={styles.headline}>
              {totals.longest_days}日で、{formatMinutes(totalSavedMinutes)}が{'\n'}戻ってきました。
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
        {vows.map((vow) => {
          const actual = yesterdayMinutes.get(vow.vow_id);
          return (
            <View key={vow.vow_id} style={styles.row}>
              <Text style={styles.label}>{vow.app_label}</Text>
              <Text style={styles.saved}>
                {actual != null
                  ? `昨日の使用 ${formatMinutes(actual)}(ふだん ${formatMinutes(vow.baseline_minutes)})→ ${formatMinutes(vow.baseline_minutes - actual)}戻った`
                  : '昨日の実測を待っています。'}
              </Text>
            </View>
          );
        })}

        <Pressable style={styles.observe} onPress={() => router.push('/(app)/observe')}>
          <Text style={styles.observeText}>時間の行き先を見る</Text>
        </Pressable>
      </View>
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
  label: { fontFamily: fonts.serif, fontSize: 17, color: colors.sumi, letterSpacing: 1 },
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
});
