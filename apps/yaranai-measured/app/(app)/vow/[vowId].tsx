// 誓い別詳細画面(アプリごとの取り戻しログ)。
// 見せるのは「何分使ったか」ではなく「何分取り戻したか」。
// 素の使用時間の推移は出さない(Digital Wellbeing化の禁止)。
// 崩れた日を責めない: 赤・警告・叱責・「連続◯日」系の表現は置かない。
//
// データソースは端末内DB(usage_daily)のみ。この画面のためにSupabaseへ
// 新たに送るデータは増やさない(五原則4)。
// 既知の制約: ローカルDBは機種変更・再インストールで消えるため、この画面の
// 日別ログも同様に消える(既知のデータ復元課題の一部)。データ復元を実装する
// ときは、この画面の材料(usage_daily の履歴)も復元対象に含めること。

import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { colors, fonts } from '@yaranai/core';
import { supabase } from '../../../lib/supabase';
import { syncLocalUsage } from '../../../lib/usage-sync';
import { getMinutesByDateForPackage, getRecordedDatesInRange } from '../../../lib/usage-db';
import { recordDateDaysAgo } from '../../../lib/dates';
import { formatMinutes } from '../../../lib/format';
import {
  buildVowLog,
  formatFullDate,
  formatMonthDay,
  stepChartPaths,
  totalSavedMinutes,
  type VowLogEntry,
} from '../../../lib/vow-log';
import { getAppLabels } from '../../../modules/usage-stats';
import { useLang, useT } from '../../../lib/i18n/context';
import { Sumiire, useSumiireRouter } from '../../../components/Sumiire';

type VowInfo = {
  package_name: string;
  app_label: string;
  baseline_minutes: number;
  declared_on: string;
};

const CHART_HEIGHT = 160;
const H_PADDING = 28;

export default function VowDetail() {
  const router = useSumiireRouter();
  const { lang } = useLang();
  const t = useT();
  const { width: windowWidth } = useWindowDimensions();
  const { vowId } = useLocalSearchParams<{ vowId: string }>();
  const [vow, setVow] = useState<VowInfo | null>(null);
  const [officialLabel, setOfficialLabel] = useState<string | null>(null);
  const [entries, setEntries] = useState<VowLogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadAll = useCallback(async () => {
    if (!vowId) return;
    const { data } = await supabase
      .from('measured_vows')
      .select('package_name, app_label, baseline_minutes, declared_on')
      .eq('id', vowId)
      .maybeSingle();
    if (!data) {
      setLoaded(true);
      return;
    }
    const info = data as VowInfo;
    setVow(info);
    setOfficialLabel(getAppLabels([info.package_name])[info.package_name] ?? null);

    // 昨日以前だけが確定。当日は増え続けるけん、この画面には一切出さない。
    await syncLocalUsage();
    const yesterday = recordDateDaysAgo(1);
    const [recordedDates, actualMinutesByDate] = await Promise.all([
      getRecordedDatesInRange(info.declared_on, yesterday),
      getMinutesByDateForPackage(info.package_name, info.declared_on, yesterday),
    ]);
    setEntries(
      buildVowLog({
        declaredOn: info.declared_on,
        lastConfirmedDate: yesterday,
        baselineMinutes: Number(info.baseline_minutes),
        recordedDates,
        actualMinutesByDate,
      }),
    );
    setLoaded(true);
  }, [vowId]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  const chartWidth = windowWidth - H_PADDING * 2;
  const totalMinutes = totalSavedMinutes(entries);

  // 累積の階段。単調非減少(vow-log.ts が保証)。獲得0・記録なしの日は横ばい。
  const chart = useMemo(() => {
    if (entries.length === 0) return null;
    const paths = stepChartPaths(
      entries.map((e) => e.cumulativeMinutes),
      chartWidth,
      CHART_HEIGHT,
    );
    return {
      line: Skia.Path.MakeFromSVGString(paths.line),
      area: Skia.Path.MakeFromSVGString(paths.area),
    };
  }, [entries, chartWidth]);

  // 日別リストは新しい日が上(降順)。有限リストとして全件描画する(高々数百行)。
  const listEntries = useMemo(() => [...entries].reverse(), [entries]);
  const hasNoneDays = entries.some((e) => e.state === 'none');

  // 未知の id(誓いが消えとった等)は静かにホームへ戻す。
  if (loaded && !vow) return <Redirect href="/(app)" />;
  // 読み込み中は生成りの地だけを敷いて静かに待つ(スピナーは出さない)
  if (!vow) return <View style={styles.container} />;

  // 誓いの行と同じく、端末の正式名を優先する(引けんときは宣言時の名前)。
  const label = officialLabel?.trim() || vow.app_label;

  return (
    <Sumiire style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>{t.vowDetail.back}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{label}</Text>

        {/* 誓いの事実。小さく、静かに */}
        <View style={styles.facts}>
          <Text style={styles.fact}>
            {t.vowDetail.declaredLine(formatFullDate(vow.declared_on, lang))}
          </Text>
          <Text style={styles.fact}>
            {t.vowDetail.baselineLine(formatMinutes(Number(vow.baseline_minutes), lang))}
          </Text>
        </View>

        {/* 累計。ホームの総計と同じ語り口 */}
        <Text style={styles.headline}>
          {t.vowDetail.totalHeadline(formatMinutes(totalMinutes, lang))}
        </Text>

        {/* 累積の階段グラフ: 消えない蓄積。崩れた日は横ばいになるだけで、下がらない */}
        {chart && (
          <View style={styles.chartBlock}>
            <Canvas style={{ width: chartWidth, height: CHART_HEIGHT }}>
              {chart.area && <Path path={chart.area} color={colors.koke} opacity={0.16} style="fill" />}
              {chart.line && (
                <Path
                  path={chart.line}
                  color={colors.koke}
                  style="stroke"
                  strokeWidth={1.5}
                  strokeJoin="round"
                />
              )}
            </Canvas>
            {/* 底の界線と、始点日・最新日だけの軸ラベル(グリッドは引かない) */}
            <View style={styles.chartBase} />
            <View style={styles.chartAxis}>
              <Text style={styles.axisLabel}>{formatMonthDay(entries[0].date, lang)}</Text>
              <Text style={styles.axisLabel}>
                {formatMonthDay(entries[entries.length - 1].date, lang)}
              </Text>
            </View>
          </View>
        )}

        {/* 日別リスト(検算用の脇役)。3態: +◯分 / 0分 / —。
            獲得0と記録なしを混同しない: 超過日を「—」で隠さず、欠測日を「0分」にしない。
            3態とも同じ文字色で並べる(獲得0を目立たせない) */}
        <View style={styles.list}>
          {listEntries.map((entry) => (
            <View key={entry.date} style={styles.row}>
              <Text style={styles.rowDate}>{formatMonthDay(entry.date, lang)}</Text>
              <Text style={styles.rowValue}>
                {entry.state === 'none'
                  ? t.vowDetail.noRecordMark
                  : entry.state === 'zero'
                    ? formatMinutes(0, lang)
                    : t.vowDetail.rowSaved(formatMinutes(entry.savedMinutes, lang))}
              </Text>
            </View>
          ))}
        </View>

        {hasNoneDays && <Text style={styles.footnote}>{t.vowDetail.noRecordNote}</Text>}
      </ScrollView>
    </Sumiire>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.kinari },
  header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 8 },
  back: { fontFamily: fonts.serif, fontSize: 13, color: colors.usuzumi, letterSpacing: 3 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: H_PADDING, paddingTop: 24, paddingBottom: 120 },
  title: {
    fontFamily: fonts.serif,
    fontSize: 22,
    lineHeight: 36,
    letterSpacing: 2,
    color: colors.sumi,
  },
  facts: { marginTop: 16, gap: 4 },
  fact: { fontSize: 12, lineHeight: 20, letterSpacing: 1, color: colors.usuzumi },
  headline: {
    marginTop: 40,
    fontFamily: fonts.serif,
    fontSize: 20,
    lineHeight: 36,
    letterSpacing: 2,
    color: colors.sumi,
  },
  chartBlock: { marginTop: 32 },
  chartBase: { height: 1, backgroundColor: colors.suna },
  chartAxis: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  axisLabel: { fontSize: 10, letterSpacing: 1, color: colors.usuzumi },
  list: { marginTop: 40 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.suna,
  },
  rowDate: { fontSize: 12, letterSpacing: 1, color: colors.usuzumi },
  rowValue: { fontSize: 12, letterSpacing: 1, color: colors.usuzumi },
  footnote: {
    marginTop: 16,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.usuzumi,
  },
});
