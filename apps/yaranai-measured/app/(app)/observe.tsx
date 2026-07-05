import { useCallback, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, fonts } from '@yaranai/core';
import { supabase } from '../../lib/supabase';
import { syncLocalUsage } from '../../lib/usage-sync';
import { getWeeklyTopApps, type WeeklyUsage } from '../../lib/usage-db';
import { recordDateDaysAgo } from '../../lib/dates';
import { isNoisePackage, labelForPackage } from '../../lib/app-labels';
import { hasUsageAccess, isUsageStatsAvailable } from '../../modules/usage-stats';

const MAX_VOWS = 3;

export default function Observe() {
  const router = useRouter();
  const [rows, setRows] = useState<WeeklyUsage[]>([]);
  const [vowedPackages, setVowedPackages] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const loadAll = useCallback(async () => {
    await syncLocalUsage();
    const [top, vowsRes] = await Promise.all([
      getWeeklyTopApps(recordDateDaysAgo(6), 30),
      supabase
        .from('measured_vows')
        .select('package_name')
        .is('discontinued_on', null),
    ]);
    setRows(top.filter((r) => !isNoisePackage(r.packageName)).slice(0, 15));
    setVowedPackages(new Set((vowsRes.data ?? []).map((v) => v.package_name)));
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isUsageStatsAvailable || !hasUsageAccess()) {
        router.replace('/(app)/permission');
        return;
      }
      loadAll();
    }, [loadAll, router])
  );

  const slotsOpen = vowedPackages.size < MAX_VOWS;

  const formatWeekly = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}時間${m}分` : `${m}分`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>時間の行き先</Text>
      <Text style={styles.subtitle}>この7日、あなたの時間はここへ。</Text>

      <View style={styles.list}>
        {rows.map((row) => {
          const vowed = vowedPackages.has(row.packageName);
          return (
            <View key={row.packageName} style={styles.row}>
              <View style={styles.rowHead}>
                <Text style={styles.label}>{labelForPackage(row.packageName)}</Text>
                <Text style={styles.minutes}>週 {formatWeekly(row.totalMinutes)}</Text>
              </View>
              <View style={styles.rowFoot}>
                <Text style={styles.avg}>1日 平均{row.avgMinutesPerDay}分</Text>
                {vowed ? (
                  <Text style={styles.vowed}>誓いのなか</Text>
                ) : (
                  slotsOpen && (
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/(app)/declare',
                          params: {
                            packageName: row.packageName,
                            label: labelForPackage(row.packageName),
                          },
                        })
                      }
                    >
                      <Text style={styles.declareLink}>これをやらない、と宣言する</Text>
                    </Pressable>
                  )
                )}
              </View>
            </View>
          );
        })}

        {loaded && rows.length === 0 && (
          <Text style={styles.empty}>
            まだ観測が集まっていません。{'\n'}この端末を使ううちに、静かに集まります。
          </Text>
        )}
      </View>

      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>戻る</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.kinari },
  content: { paddingHorizontal: 28, paddingTop: 64, paddingBottom: 80 },
  title: {
    fontFamily: fonts.serif,
    fontSize: 20,
    letterSpacing: 4,
    color: colors.sumi,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    marginBottom: 40,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.usuzumi,
    textAlign: 'center',
  },
  list: { gap: 24 },
  row: {
    gap: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.suna,
  },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontFamily: fonts.serif, fontSize: 16, color: colors.sumi, letterSpacing: 1 },
  minutes: { fontSize: 12, color: colors.sumi },
  rowFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  avg: { fontSize: 11, color: colors.usuzumi },
  vowed: { fontSize: 11, color: colors.koke, letterSpacing: 2 },
  declareLink: { fontSize: 12, color: colors.shu, letterSpacing: 1 },
  empty: {
    fontSize: 13,
    lineHeight: 24,
    color: colors.usuzumi,
    textAlign: 'center',
    marginTop: 24,
  },
  back: { marginTop: 48, paddingVertical: 10, alignItems: 'center' },
  backText: { fontFamily: fonts.serif, fontSize: 13, color: colors.usuzumi, letterSpacing: 3 },
});
