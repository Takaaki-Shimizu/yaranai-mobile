import { useCallback, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, fonts } from '@yaranai/core';
import { supabase } from '../../lib/supabase';
import { syncLocalUsage } from '../../lib/usage-sync';
import { getWeeklyTopApps } from '../../lib/usage-db';
import { recordDateDaysAgo } from '../../lib/dates';
import { BASELINE_MIN_DAYS, measureBaselineWindow } from '../../lib/baseline';
import { averageMinutesPerDay } from '../../lib/usage-buckets';
import { isNoisePackage, labelForPackage } from '../../lib/app-labels';
import { formatMinutes } from '../../lib/format';
import { hasUsageAccess, isUsageStatsAvailable } from '../../modules/usage-stats';

const MAX_VOWS = 3;

// 候補の表示上限。並びは12週平均やけん、使い始めて日が浅いアプリは平均が
// 希釈されて下位に沈む。直近7日に使っとる習慣を切り落とさんよう余裕を持たせる。
const MAX_CANDIDATES = 30;

// 「使った」とみなす直近7日の合計の下限。システムが一瞬だけ前面に出す部品
// (検索セレクタ・動画プレイヤー・Wellbeing など)やアラーム解除だけの時計が
// 候補に並ぶと、本人が使っとる認識のないアプリだらけになるけん足切りする。
const MIN_WEEKLY_TOTAL_MINUTES = 10;

// 12週平均がこれ未満(四捨五入で表示が「0分」になる)のアプリは、
// 宣言しても取り戻せる時間がないけん候補に出さない。
const MIN_AVG_MINUTES = 0.5;

// 一覧の1行。数字は基準線と同じ12週平均(宣言すると、この数字がそのまま固定される)。
type ObserveRow = {
  packageName: string;
  avgMinutesPerDay: number;
};

export default function Observe() {
  const router = useRouter();
  const [rows, setRows] = useState<ObserveRow[]>([]);
  const [vowedPackages, setVowedPackages] = useState<Set<string>>(new Set());
  const [availableDays, setAvailableDays] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const loadAll = useCallback(async () => {
    await syncLocalUsage();
    // 直近7日に使ったアプリだけを候補にする(今も続いとる習慣のフィルタ)。
    // 並び順と表示は12週平均: 一時的な急増は平均に吸収され、
    // やめ済みアプリを宣言して基準線だけ稼ぐ抜け道も防ぐ。
    const [recent, vowsRes] = await Promise.all([
      getWeeklyTopApps(recordDateDaysAgo(6), 100),
      supabase
        .from('measured_vows')
        .select('package_name')
        .is('discontinued_on', null),
    ]);
    const baseline = measureBaselineWindow();
    setAvailableDays(baseline.availableDays);
    if (baseline.availableDays >= BASELINE_MIN_DAYS) {
      const candidates = recent
        .filter((r) => !isNoisePackage(r.packageName))
        .map((r) => ({
          packageName: r.packageName,
          avgMinutesPerDay: averageMinutesPerDay(baseline.window, r.packageName),
          weeklyTotalMinutes: r.totalMinutes,
        }))
        .sort((a, b) => b.avgMinutesPerDay - a.avgMinutesPerDay);
      const shown = candidates
        .filter(
          (r) =>
            r.weeklyTotalMinutes >= MIN_WEEKLY_TOTAL_MINUTES &&
            r.avgMinutesPerDay >= MIN_AVG_MINUTES,
        )
        .slice(0, MAX_CANDIDATES);
      setRows(shown);
      // 調査用: 候補がどの段階で消えたかを実機ログで追えるようにする
      // (adb logcat -s ReactNativeJS UsageStats)。端末の外には出ない。
      const shownSet = new Set(shown.map((r) => r.packageName));
      console.log(
        `[observe] recent7d=${recent.length} candidates=${candidates.length} ` +
          `shown=${shown.length} availableDays=${baseline.availableDays}`,
      );
      for (const c of candidates) {
        const state = shownSet.has(c.packageName)
          ? 'show'
          : c.weeklyTotalMinutes < MIN_WEEKLY_TOTAL_MINUTES
            ? 'drop:weekly'
            : c.avgMinutesPerDay < MIN_AVG_MINUTES
              ? 'drop:avg'
              : 'drop:limit';
        console.log(
          `[observe] ${state} ${c.packageName} 7d合計=${c.weeklyTotalMinutes}m 12w=${c.avgMinutesPerDay}m/d`,
        );
      }
    } else {
      setRows([]);
    }
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
  const gathering = loaded && availableDays < BASELINE_MIN_DAYS;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>時間の行き先</Text>
      <Text style={styles.subtitle}>この12週、あなたの時間はここへ。</Text>
      <Text style={styles.note}>
        直近7日に使ったアプリを、12週の1日平均で。{'\n'}
        宣言すると、この平均がそのまま、あなたの「ふだん」になります。
      </Text>

      <View style={styles.list}>
        {rows.map((row) => {
          const vowed = vowedPackages.has(row.packageName);
          return (
            <View key={row.packageName} style={styles.row}>
              <View style={styles.rowHead}>
                <Text style={styles.label}>{labelForPackage(row.packageName)}</Text>
                <Text style={styles.minutes}>1日 平均{formatMinutes(row.avgMinutesPerDay)}</Text>
              </View>
              <View style={styles.rowFoot}>
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

        {gathering && (
          <Text style={styles.empty}>
            まだ記録を集めています。{'\n'}
            この端末の記録が{BASELINE_MIN_DAYS}日ぶんに満ちると、{'\n'}
            時間の行き先が見えるようになります。{'\n'}
            いまは{availableDays}日ぶんです。
          </Text>
        )}
        {loaded && !gathering && rows.length === 0 && (
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
    marginBottom: 12,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.usuzumi,
    textAlign: 'center',
  },
  note: {
    marginBottom: 40,
    fontSize: 11,
    lineHeight: 20,
    letterSpacing: 1,
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
  rowFoot: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'baseline' },
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
