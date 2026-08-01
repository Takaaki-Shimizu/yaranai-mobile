import { useCallback, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, fonts } from '@yaranai/core';
import { supabase } from '../../lib/supabase';
import { syncLocalUsage } from '../../lib/usage-sync';
import { getWeeklyTopApps } from '../../lib/usage-db';
import { recentWindowStart } from '../../lib/dates';
import { BASELINE_MIN_DAYS, measureBaselineWindow } from '../../lib/baseline';
import { averageMinutesPerDay } from '../../lib/usage-buckets';
import { isNoisePackage, labelForPackage } from '../../lib/app-labels';
import { formatMinutes } from '../../lib/format';
import { getAppLabels, hasUsageAccess, isUsageStatsAvailable } from '../../modules/usage-stats';
import { useLang, useT } from '../../lib/i18n/context';
import { isMissingGraduatedOn, MAX_VOWS } from '../../lib/vows';
import { Sumiire, useSumiireRouter } from '../../components/Sumiire';

// 候補の表示上限。並びは12週平均やけん、使い始めて日が浅いアプリは平均が
// 希釈されて下位に沈む。直近7日に使っとる習慣を切り落とさんよう余裕を持たせる。
const MAX_CANDIDATES = 30;

// 「使った」とみなす直近7日の合計の下限。システムが一瞬だけ前面に出す部品
// (検索セレクタ・動画プレイヤー・Wellbeing など)やアラーム解除だけの時計が
// 候補に並ぶと、本人が使っとる認識のないアプリだらけになるけん足切りする。
// 誓いのなか・卒業済みのアプリはこの足切りを免除する(下の shown を参照)。
const MIN_WEEKLY_TOTAL_MINUTES = 5;

// 12週平均がこれ未満(四捨五入で表示が「0分」になる)のアプリは、
// 宣言しても取り戻せる時間がないけん候補に出さない。
const MIN_AVG_MINUTES = 0.5;

// 一覧の1行。数字は基準線と同じ12週平均(宣言すると、この数字がそのまま固定される)。
type ObserveRow = {
  packageName: string;
  avgMinutesPerDay: number;
};

// 誓いの状態(卒業機能 §1)。挑戦中だけが3本の枠を占める。
type VowState = 'active' | 'graduated';

// 生きた誓いの一覧。マイグレーション 003 未適用の Supabase では graduated_on 列が
// 無く 42703 で落ちるけん、そのときだけ列なしで引き直し、全行を挑戦中として扱う
// (旧スキーマに卒業済みは存在せん)。空扱いに落とすと、誓いの立っとるアプリに
// 「宣言する」が出て、枠判定も狂う。
async function fetchLivingVows() {
  const full = await supabase
    .from('measured_vows')
    .select('package_name, graduated_on')
    .is('discontinued_on', null);
  if (!isMissingGraduatedOn(full.error)) return full;
  const legacy = await supabase
    .from('measured_vows')
    .select('package_name')
    .is('discontinued_on', null);
  return {
    ...legacy,
    data: legacy.data?.map((v) => ({ ...v, graduated_on: null })) ?? null,
  };
}

export default function Observe() {
  const router = useSumiireRouter();
  const { lang } = useLang();
  const t = useT();
  const [rows, setRows] = useState<ObserveRow[]>([]);
  // 端末に登録された正式なアプリ名。引けんパッケージはキーが無く、表示は整形へ倒れる。
  const [officialLabels, setOfficialLabels] = useState<Record<string, string>>({});
  // 誓いのあるパッケージと、その状態。挑戦中と卒業済みで行の見え方が変わる
  // (卒業機能 §5-3)。廃止した誓いはここに入れん(= もう一度宣言できる)。
  const [vowStates, setVowStates] = useState<Map<string, VowState>>(new Map());
  const [availableDays, setAvailableDays] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const loadAll = useCallback(async () => {
    await syncLocalUsage();
    // 直近7日に使ったアプリだけを候補にする(今も続いとる習慣のフィルタ)。
    // 並び順と表示は12週平均: 一時的な急増は平均に吸収され、
    // やめ済みアプリを宣言して基準線だけ稼ぐ抜け道も防ぐ。
    // 候補窓は当日を含む7日。卒業判定は前日までの7日(lib/dates.ts)で1日ずれるが、
    // 「消えた = 卒業できる」の対応は誓いのなかのアプリの足切り免除で保証する:
    // 1分でも使えばここに並び続けるけん、「並んどらんのに卒業できん」は起きん。
    const [recent, vowsRes] = await Promise.all([
      getWeeklyTopApps(recentWindowStart(), 100),
      fetchLivingVows(),
    ]);
    const baseline = measureBaselineWindow();
    setAvailableDays(baseline.availableDays);
    // 調査用: 集計できた日数はゲートの内外どちらでも出す。以前は表示できたときだけ
    // 出しとったけん、「まだ記録を集めています」に落ちた原因が実機ログで追えんかった。
    console.log(
      `[observe] availableDays=${baseline.availableDays} need=${BASELINE_MIN_DAYS} ` +
        `coveredMs=${baseline.window.coveredMs} recent7d=${recent.length}`,
    );
    if (baseline.availableDays >= BASELINE_MIN_DAYS) {
      // 誓いのある(挑戦中・卒業済み)パッケージは足切りと件数上限を免除する。
      // 卒業済みが1分でも使えばここに再浮上して「計測に戻す」が届き、
      // 挑戦中は「時間の行き先から消えた = 卒業できる」の対応が崩れん。
      // 廃止済みは vowsRes に含まれん(= ただの候補として扱う)。
      const vowedPkgs = new Set((vowsRes.data ?? []).map((v) => v.package_name as string));
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
            vowedPkgs.has(r.packageName) ||
            (r.weeklyTotalMinutes >= MIN_WEEKLY_TOTAL_MINUTES &&
              r.avgMinutesPerDay >= MIN_AVG_MINUTES),
        )
        .filter((r, i) => i < MAX_CANDIDATES || vowedPkgs.has(r.packageName));
      setRows(shown);
      setOfficialLabels(getAppLabels(shown.map((r) => r.packageName)));
      // 調査用: 候補がどの段階で消えたかを実機ログで追えるようにする
      // (adb logcat -s ReactNativeJS UsageStats)。端末の外には出ない。
      const shownSet = new Set(shown.map((r) => r.packageName));
      console.log(`[observe] candidates=${candidates.length} shown=${shown.length}`);
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
      setOfficialLabels({});
    }
    // 誓いが引けんかった回は前回の状態を残す。空の Map に落とすと、誓いの
    // 立っとるアプリにまで「宣言する」が並んでしまう。
    if (!vowsRes.error) {
      setVowStates(
        new Map(
          (vowsRes.data ?? []).map((v) => [
            v.package_name as string,
            (v.graduated_on ? 'graduated' : 'active') as VowState,
          ]),
        ),
      );
    }
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

  // 枠を占めるのは挑戦中の誓いだけ。卒業済みは数えん(卒業機能 §1)。
  // ここを discontinued_on だけで数えると、卒業で空いたはずの枠が埋まったままになる。
  const activeCount = [...vowStates.values()].filter((s) => s === 'active').length;
  const slotsOpen = activeCount < MAX_VOWS;
  const gathering = loaded && availableDays < BASELINE_MIN_DAYS;

  return (
    <Sumiire style={styles.container}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t.observe.title}</Text>
      <Text style={styles.subtitle}>{t.observe.subtitle}</Text>
      <Text style={styles.note}>{t.observe.note}</Text>

      <View style={styles.list}>
        {rows.map((row) => {
          const vowState = vowStates.get(row.packageName);
          const label = labelForPackage(row.packageName, officialLabels);
          return (
            <View key={row.packageName} style={styles.row}>
              <View style={styles.rowHead}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.minutes}>
                  {t.observe.avgPerDay(formatMinutes(row.avgMinutesPerDay, lang))}
                </Text>
              </View>
              <View style={styles.rowFoot}>
                {vowState === 'active' && <Text style={styles.vowed}>{t.observe.vowed}</Text>}
                {/* 卒業済みのアプリがここに並んどるということは、ぶり返して
                    時間の行き先に再浮上したということ。復帰の導線はこの一箇所だけで、
                    こちらから知らせには行かない(五原則1)。宣言ではなく復帰やけん、
                    基準線は declare 側でも再計算せん */}
                {vowState === 'graduated' && (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/(app)/declare',
                        params: { packageName: row.packageName, label },
                      })
                    }
                  >
                    <Text style={styles.declareLink}>{t.observe.restoreLink}</Text>
                  </Pressable>
                )}
                {vowState === undefined && slotsOpen && (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/(app)/declare',
                        params: { packageName: row.packageName, label },
                      })
                    }
                  >
                    <Text style={styles.declareLink}>{t.observe.declareLink}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}

        {gathering && (
          <Text style={styles.empty}>
            {t.observe.gathering(BASELINE_MIN_DAYS, availableDays)}
          </Text>
        )}
        {loaded && !gathering && rows.length === 0 && (
          <Text style={styles.empty}>{t.observe.empty}</Text>
        )}
      </View>

      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>{t.observe.back}</Text>
      </Pressable>
    </ScrollView>
    </Sumiire>
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
