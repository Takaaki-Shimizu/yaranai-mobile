import { useCallback, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, RefreshControl, useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSession, colors, fonts } from '@yaranai/core';
import { supabase } from '../../lib/supabase';
import { syncAll } from '../../lib/usage-sync';
import { recordDateDaysAgo } from '../../lib/dates';
import { formatMinutes } from '../../lib/format';
import { hasUsageAccess, isUsageStatsAvailable } from '../../modules/usage-stats';
import { HomeGarden } from '../../components/garden/HomeGarden';
import { DevGarden } from '../../components/garden/DevGarden';
import { loadGrowth, loadLastSeen, saveLastSeen } from '../../components/garden/load';
import { HOME_ASPECT } from '../../lib/garden/scene';
import { isEngawaOpen } from '../../lib/garden/gate';
import { changedCategories, changeNote } from '../../lib/garden/diff';
import { useIsDeveloper } from '../../lib/developer';
import type { GrowthParams } from '../../lib/garden/growth';

type VowSummary = {
  vow_id: string;
  app_label: string;
  baseline_minutes: number;
  saved_minutes: number;
  discontinued_on: string | null;
};

type Totals = {
  longest_days: number;
};

export default function Home() {
  const session = useSession();
  const isDeveloper = useIsDeveloper();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const [vows, setVows] = useState<VowSummary[]>([]);
  const [totalSavedMinutes, setTotalSavedMinutes] = useState(0);
  const [yesterdayMinutes, setYesterdayMinutes] = useState<Map<string, number>>(new Map());
  const [totals, setTotals] = useState<Totals | null>(null);
  const [growth, setGrowth] = useState<GrowthParams | null>(null);
  // 入庭時の差分演出(§変更4): 前回表示時の状態と、変化があった場合の一行
  const [prevGrowth, setPrevGrowth] = useState<GrowthParams | null>(null);
  const [gardenNote, setGardenNote] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    // 累計はやめた誓いも含めた全体。行の表示はアクティブな誓いだけ。
    const [totalsRes, vowsRes, dailyRes, growthRes] = await Promise.all([
      supabase.from('garden_state').select('longest_days').maybeSingle(),
      supabase
        .from('measured_saved')
        .select('vow_id, app_label, baseline_minutes, saved_minutes, discontinued_on')
        .order('declared_on', { ascending: true }),
      supabase
        .from('measured_daily')
        .select('vow_id, actual_minutes')
        .eq('record_date', recordDateDaysAgo(1)),
      session ? loadGrowth(session.user.id) : Promise.resolve(null),
    ]);
    const allVows = (vowsRes.data ?? []) as VowSummary[];
    setTotals(totalsRes.data ?? null);
    setVows(allVows.filter((v) => v.discontinued_on === null));
    setTotalSavedMinutes(allVows.reduce((sum, v) => sum + v.saved_minutes, 0));
    setYesterdayMinutes(
      new Map((dailyRes.data ?? []).map((d) => [d.vow_id as string, d.actual_minutes as number])),
    );
    setGrowth(growthRes);

    // §変更4: 前回表示時の状態と比べ、変化があれば差分演出+一行を用意し、現在状態を保存する。
    // 初回(スナップショットなし)は演出をスキップし、現在状態をそのまま保存する。
    if (session && growthRes) {
      const prev = await loadLastSeen(session.user.id);
      const cats = changedCategories(prev, growthRes);
      setPrevGrowth(cats.length ? prev : null);
      setGardenNote(changeNote(cats));
      saveLastSeen(session.user.id, growthRes);
    } else {
      setPrevGrowth(null);
      setGardenNote(null);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      // 開発者モード(§5): 実測パイプラインには触れない。
      // 許可も促さず、Supabase の読み込みもしない。庭はスライダーで組む。
      if (isDeveloper) return;
      // 許可がなければ、まず許可の画面へ
      if (!isUsageStatsAvailable || !hasUsageAccess()) {
        router.replace('/(app)/permission');
        return;
      }
      loadAll();
    }, [isDeveloper, loadAll, router])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    if (session && !isDeveloper) await syncAll(session.user.id);
    await loadAll();
    setRefreshing(false);
  };

  // ホームの庭窓は全幅・構図の 90%×縦100%。アスペクト 1.35:1 で高さが決まる(§変更1)。
  // 例: 幅390pt → 高さ≈289pt(縦画面844ptの約34%)。スクロール不要で全体が見える。
  const gardenHeight = Math.round(windowWidth / HOME_ASPECT);

  const onGardenPress = () => {
    // 庭モード(絵巻)は週の節目にのみ開く。閉扉中は静かに何もしない
    if (isEngawaOpen(new Date())) {
      router.push('/(app)/garden');
    }
  };

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

      {/* 開発者モード(§2): 庭のパラメータ手動注入UI。実測・高水位・差分演出は通さない */}
      {isDeveloper ? (
        <DevGarden />
      ) : (
      <>
      {/* 庭: ホームの窓(静止画・全幅)。タップで絵巻へ */}
      {growth && growth.stones > 0 ? (
        <Pressable onPress={onGardenPress}>
          <HomeGarden growth={growth} height={gardenHeight} prevGrowth={prevGrowth} />
        </Pressable>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.headline}>ここから、始まる。</Text>
        </View>
      )}

      {/* 蓄積 */}
      {totals && Math.round(totalSavedMinutes) > 0 && (
        <View style={styles.stats}>
          <Text style={styles.headline}>
            {totals.longest_days}日で、{formatMinutes(totalSavedMinutes)}が{'\n'}戻ってきました。
          </Text>
          {/* §変更4: 変化があったときだけ、過去形・数字なしの一行を添える */}
          {gardenNote && <Text style={styles.changeNote}>{gardenNote}</Text>}
        </View>
      )}

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
      </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.kinari },
  content: { paddingBottom: 80 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 28,
    paddingTop: 64,
    paddingBottom: 20,
  },
  wordmark: { fontFamily: fonts.serif, fontSize: 16, letterSpacing: 6, color: colors.sumi },
  signOut: { fontSize: 11, color: colors.usuzumi, letterSpacing: 2 },

  empty: { paddingVertical: 72, alignItems: 'center' },
  stats: { paddingVertical: 40, paddingHorizontal: 28, alignItems: 'center' },
  changeNote: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 28,
    letterSpacing: 2,
    color: colors.usuzumi,
    textAlign: 'center',
    marginTop: 24,
  },
  headline: {
    fontFamily: fonts.serif,
    fontSize: 22,
    lineHeight: 40,
    letterSpacing: 2,
    color: colors.sumi,
    textAlign: 'center',
  },
  list: { gap: 28, paddingHorizontal: 28 },
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
