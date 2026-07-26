import { useCallback, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, RefreshControl, useWindowDimensions,
  type StyleProp, type ViewStyle,
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
import { changedCategories, changeNote, type DiffCategory } from '../../lib/garden/diff';
import { useIsDeveloper } from '../../lib/developer';
import { evaluateCrashedDay, evaluateStanding } from '../../lib/articles/evaluate';
import { loadArticlesState } from '../../lib/articles/storage';
import { newestUnread, previewStripArticle, type ArticleListItem } from '../../lib/articles/select';
import type { ArticlesState } from '../../lib/articles/types';
import { AppMenu } from '../../components/AppMenu';
import { IdealHeader } from '../../components/IdealHeader';
import { useLang, useT } from '../../lib/i18n/context';
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
  const { lang } = useLang();
  const t = useT();
  const { width: windowWidth } = useWindowDimensions();
  const [vows, setVows] = useState<VowSummary[]>([]);
  const [totalSavedMinutes, setTotalSavedMinutes] = useState(0);
  const [yesterdayMinutes, setYesterdayMinutes] = useState<Map<string, number>>(new Map());
  const [totals, setTotals] = useState<Totals | null>(null);
  const [growth, setGrowth] = useState<GrowthParams | null>(null);
  // 入庭時の差分演出(§変更4): 前回表示時の状態と、変化した種別。
  // 一行の文言はレンダー時に言語をかけて組む(切替が即時に効くように、文字列では持たない)。
  const [prevGrowth, setPrevGrowth] = useState<GrowthParams | null>(null);
  const [gardenCats, setGardenCats] = useState<DiffCategory[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  // 読みもの(§5.1): 記事状態を素のまま持ち、未読の帯の1本はレンダー時に言語をかけて選ぶ。
  const [articlesState, setArticlesState] = useState<ArticlesState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
      setGardenCats(cats);
      saveLastSeen(session.user.id, growthRes);
    } else {
      setPrevGrowth(null);
      setGardenCats([]);
    }

    // 読みもの(§5.1): 発火判定を回してから状態を読み、未読の帯を1本だけ出す。
    // standing はホーム表示時に無条件で評価する(v1.1 §4.2)。usage-sync の完了を
    // 待つ必要はないが、同一キーへの書き込みが重ならないよう crashedDay と直列に回す。
    // 起動時の判定(_layout)と競合しても冪等・単調なので二重発火にはならない。
    // 既読になった帯は次の focus でここから消える(演出は入れない)。
    await evaluateStanding();
    await evaluateCrashedDay();
    setArticlesState(await loadArticlesState());
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

  // 言語依存の表示はレンダー時に組む(メニューでの切替が開いたままの画面にも即時に効く)。
  const gardenNote = changeNote(gardenCats, lang);
  const unreadArticle = articlesState ? newestUnread(articlesState, lang) : null;

  // 開発者モードのホームに常設する読みものの帯(発火判定を通らないため常に表示)。
  const devStripArticle = previewStripArticle(lang);

  const onGardenPress = () => {
    // 庭モード(絵巻)は週の節目(土曜・日曜)にのみ開く。閉扉中は静かに何もしない
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
        {/* §5.3: 「退出」を撤去し、ハンバーガー(三本線)へ差し替える */}
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={12} accessibilityLabel={t.menu.a11yLabel}>
          <View style={styles.hamburger}>
            <View style={styles.hbLine} />
            <View style={styles.hbLine} />
            <View style={styles.hbLine} />
          </View>
        </Pressable>
      </View>

      <AppMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* 理想(WHAT)は庭の直上に常設する。開発者モードでも同じ枠を使い、
          未入力でも高さを確保するので庭の描画開始位置は動かない */}
      <IdealHeader />

      {/* 開発者モード(§2): 庭のパラメータ手動注入UI。実測・高水位・差分演出は通さない */}
      {isDeveloper ? (
        <>
          <DevGarden />
          {/* 開発者モードは計測しないため発火条件を満たさない。読みものは常に表示する
              (登録簿の先頭)。永続状態は参照せず、タップで記事画面を確認できる */}
          {devStripArticle && (
            <ReadingStrip
              article={devStripArticle}
              onPress={() => router.push(`/(app)/reading/${devStripArticle.id}`)}
            />
          )}
        </>
      ) : (
      <>
      {/* 庭: ホームの窓(静止画・全幅)。タップで絵巻へ */}
      {growth && growth.stones > 0 ? (
        <Pressable onPress={onGardenPress}>
          <HomeGarden growth={growth} height={gardenHeight} prevGrowth={prevGrowth} />
        </Pressable>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.headline}>{t.home.emptyHeadline}</Text>
        </View>
      )}

      {/* 読みもの: 未読の帯(§5.1)。庭と累計の一文の間に置く。
          「戻ってきました。」とアプリ行の間に挟むと文意が切れるため、庭の直下に出す。
          罫線2本のみ・カード化しない。未読の印は点1個。タップで記事へ。
          庭からは 28、下は累計ブロックの余白 40 で挟み、帯が窮屈に見えないようにする。
          既読になった帯は次の focus でここから消える(演出なし) */}
      {unreadArticle && (
        <ReadingStrip
          style={styles.stripHome}
          article={unreadArticle}
          onPress={() => router.push(`/(app)/reading/${unreadArticle.id}`)}
        />
      )}

      {/* 蓄積 */}
      {totals && Math.round(totalSavedMinutes) > 0 && (
        <View style={[styles.stats, unreadArticle && styles.statsUnderStrip]}>
          <Text style={styles.headline}>
            {t.home.savedHeadline(totals.longest_days, formatMinutes(totalSavedMinutes, lang))}
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
                  ? t.home.rowSaved(
                      formatMinutes(actual, lang),
                      formatMinutes(vow.baseline_minutes, lang),
                      formatMinutes(vow.baseline_minutes - actual, lang),
                    )
                  : t.home.rowWaiting}
              </Text>
            </View>
          );
        })}

        <Pressable style={styles.observe} onPress={() => router.push('/(app)/observe')}>
          <Text style={styles.observeText}>{t.home.observeLink}</Text>
        </Pressable>
      </View>
      </>
      )}
    </ScrollView>
  );
}

// 読みものの帯(§5.1)。通常モード(未読の1本)と開発者モード(常設)で共用する。
// 置き場所ごとの余白は style で外から足す(帯そのものの見た目は変えない)。
function ReadingStrip({
  article,
  onPress,
  style,
}: {
  article: ArticleListItem;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useT();
  return (
    <Pressable style={[styles.strip, style]} onPress={onPress}>
      <View>
        <Text style={styles.stripLabel}>{t.home.stripLabel}</Text>
        <Text style={styles.stripTitle}>{article.title}</Text>
      </View>
      {article.unread && <View style={styles.dot} />}
    </Pressable>
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
  hamburger: { width: 20, height: 14, justifyContent: 'space-between' },
  hbLine: { height: 1, backgroundColor: colors.usuzumi },

  // 読みものの帯(§5.1): 上下1pxの罫線のみ。背景色・影・角丸なし。
  strip: {
    marginHorizontal: 28,
    marginTop: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.suna,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // ホームでは庭と累計の一文の間に挟むので、上下に息をつける余白を持たせる。
  // 下の 40 は、累計ブロック非表示(戻り時間が 0)のときも帯がアプリ行に貼りつかないため。
  stripHome: { marginTop: 28, marginBottom: 40 },
  stripLabel: { fontSize: 10, color: colors.usuzumi, letterSpacing: 3 },
  stripTitle: {
    marginTop: 5,
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.sumi,
    letterSpacing: 1,
  },
  // 未読の点(6px・生成りに沈む茶灰。モックの --tensen)。点以外の未読表現は使わない。
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#A9A28B' },

  empty: { paddingVertical: 72, alignItems: 'center' },
  stats: { paddingVertical: 40, paddingHorizontal: 28, alignItems: 'center' },
  // 帯が上にあるときは、帯の下余白(40)と二重にしない。
  statsUnderStrip: { paddingTop: 0 },
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
