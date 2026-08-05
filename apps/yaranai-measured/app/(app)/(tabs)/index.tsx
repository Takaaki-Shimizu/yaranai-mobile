import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, RefreshControl, useWindowDimensions,
  type StyleProp, type ViewStyle,
} from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { useSession, colors, fonts } from '@yaranai/core';
import { supabase } from '../../../lib/supabase';
import { syncAll } from '../../../lib/usage-sync';
import { recordDateDaysAgo } from '../../../lib/dates';
import { findGraduablePackages } from '../../../lib/graduation-check';
import { formatMinutes } from '../../../lib/format';
import { getAppLabels, hasUsageAccess, isUsageStatsAvailable } from '../../../modules/usage-stats';
import { HomeGarden } from '../../../components/garden/HomeGarden';
import { DevGarden } from '../../../components/garden/DevGarden';
import { loadGrowth, loadLastSeen, saveLastSeen } from '../../../components/garden/load';
import { HOME_ASPECT } from '../../../lib/garden/scene';
import { isEngawaOpen } from '../../../lib/garden/gate';
import { changedCategories, changeNote, diffDuration, type DiffCategory } from '../../../lib/garden/diff';
import { useIsDeveloper } from '../../../lib/developer';
import { TojiruCurtain } from '../../../components/tojiru/TojiruCurtain';
import { exitToBackground } from '../../../lib/tojiru/exit';
import { TOJIRU_TIMELINE } from '../../../lib/tojiru/timeline';
import { useReduceMotion } from '../../../lib/use-reduce-motion';
import { useForegroundGeneration } from '../../../lib/use-foreground';
import { evaluateCrashedDay, evaluateStanding } from '../../../lib/articles/evaluate';
import { loadArticlesState } from '../../../lib/articles/storage';
import { newestUnread, previewStripArticle, type ArticleListItem } from '../../../lib/articles/select';
import type { ArticlesState } from '../../../lib/articles/types';
import { AppMenuButton } from '../../../components/AppMenu';
import { AppFooter, FOOTER_HEIGHT } from '../../../components/AppFooter';
import { Sumiire, useSumiireRouter } from '../../../components/Sumiire';
import { IdealHeader } from '../../../components/IdealHeader';
import { GoldRule, GrainOverlay, HeaderWashi } from '../../../components/washi/Washi';
import { useLang, useT } from '../../../lib/i18n/context';
import { isMissingGraduatedOn, MAX_VOWS } from '../../../lib/vows';
import type { GrowthParams } from '../../../lib/garden/growth';
import { BASELINE_MIN_DAYS, measureBaselineWindow } from '../../../lib/baseline';
import {
  clearWaitingMode,
  isDisclosureSeen,
  isOnboardingDone,
  isPermissionDeferred,
  isWaitingMode,
  markOnboardingDone,
} from '../../../lib/onboarding';

// ホームの門(オンボーディング §0)。焦点が当たるたびに、どの姿で出すかを決める:
//   checking  判定中(生成りの地だけ)
//   noAccess  許可を「あとで」にした人の観測なしの状態(例外系①)
//   waiting   履歴28日未満の待機モード(例外系③)
//   ready     ふだんのホーム
type HomeGate = 'checking' | 'noAccess' | 'waiting' | 'ready';

type VowSummary = {
  vow_id: string;
  package_name: string;
  app_label: string;
  baseline_minutes: number;
  saved_minutes: number;
  discontinued_on: string | null;
  // 卒業日(卒業機能 §1)。null = 挑戦中。値が入っとっても計測と取り戻しは続く
  graduated_on: string | null;
};

type Totals = {
  longest_days: number;
};

// ホームに出す誓い一覧。graduated_on はマイグレーション 003 で入る列で、未適用の
// Supabase に対しては select ごと 42703 で落ちる。その一点だけは列なしの旧スキーマ
// として引き直し、全行を挑戦中(graduated_on: null)として返す ── 旧スキーマに
// 卒業済みは存在せんけん、意味もこれで合う。畳まれるのは卒業の導線だけで、
// 計測中の誓いの表示は一行も欠けない。
// 並びは宣言日 → パッケージ名。declared_on は暦日やけん同日宣言で並ぶことがあり、
// タイブレークを置かんとビューの作り直し(003)のたびに物理順で入れ替わって見える。
// 意味のある第2キー(宣言時刻)はビューに出とらんけん、決定的で説明のつく
// パッケージ名で留める。
async function fetchVowSummaries() {
  const columns =
    'vow_id, package_name, app_label, baseline_minutes, saved_minutes, discontinued_on';
  const full = await supabase
    .from('measured_saved')
    .select(`${columns}, graduated_on`)
    .order('declared_on', { ascending: true })
    .order('package_name', { ascending: true });
  if (!isMissingGraduatedOn(full.error)) return full;
  const legacy = await supabase
    .from('measured_saved')
    .select(columns)
    .order('declared_on', { ascending: true })
    .order('package_name', { ascending: true });
  return {
    ...legacy,
    data: legacy.data?.map((v) => ({ ...v, graduated_on: null })) ?? null,
  };
}

export default function Home() {
  const session = useSession();
  const isDeveloper = useIsDeveloper();
  // 遷移は「筆を引いてから移る」(components/Sumiire.tsx)。router を直接叩かない
  const router = useSumiireRouter();
  const { lang } = useLang();
  const t = useT();
  const { width: windowWidth } = useWindowDimensions();
  const [vows, setVows] = useState<VowSummary[]>([]);
  // 卒業済みの誓い(卒業機能 §5-1)。挑戦中の下に淡色で名前だけ並べる
  const [graduatedVows, setGraduatedVows] = useState<VowSummary[]>([]);
  // 卒業条件が成立した挑戦中の誓い。この集合の行にだけ「卒業する」が現れる
  const [graduableVowIds, setGraduableVowIds] = useState<Set<string>>(new Set());
  const [totalSavedMinutes, setTotalSavedMinutes] = useState(0);
  // 誓いの行に出す名前は、宣言時に保存した app_label より端末の正式名を優先する
  // (「Mitene」で宣言済みの誓いも、次の表示から「みてね」になる)。
  const [officialLabels, setOfficialLabels] = useState<Record<string, string>>({});
  const [yesterdayMinutes, setYesterdayMinutes] = useState<Map<string, number>>(new Map());
  const [totals, setTotals] = useState<Totals | null>(null);
  const [growth, setGrowth] = useState<GrowthParams | null>(null);
  // 庭が引けず、高水位も無くて蓄積が分からん状態。宣言前の空文言とは別の面を出す
  const [gardenUnavailable, setGardenUnavailable] = useState(false);
  // 入庭時の差分演出(§変更4): 前回表示時の状態と、変化した種別。
  // 一行の文言はレンダー時に言語をかけて組む(切替が即時に効くように、文字列では持たない)。
  const [prevGrowth, setPrevGrowth] = useState<GrowthParams | null>(null);
  const [gardenCats, setGardenCats] = useState<DiffCategory[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  // 読みもの(§5.1): 記事状態を素のまま持ち、未読の帯の1本はレンダー時に言語をかけて選ぶ。
  const [articlesState, setArticlesState] = useState<ArticlesState | null>(null);
  // ホームの門(オンボーディング §0)。判定が済むまでは生成りの地だけを敷く
  const [gate, setGate] = useState<HomeGate>('checking');
  // 待機モードの「いま◯日目」(§5)。カウントダウンにはしない
  const [waitingDays, setWaitingDays] = useState(1);
  // 閉じ際演出「とじる」(§1)。演出中はホームのUIを退場させ、覆いに任せる。
  const [closing, setClosing] = useState(false);
  const contentOpacity = useSharedValue(1);
  const reduceMotion = useReduceMotion();
  const foreground = useForegroundGeneration();
  // 入場差分アニメが流れ終わる時刻(ms)。この間の「とじる」は無視する(§6)
  const diffUntil = useRef(0);

  const loadAll = useCallback(async () => {
    // 累計はやめた誓い・卒業した誓いも含めた全体。行に数字を出すのは挑戦中の誓いだけ。
    const [totalsRes, vowsRes, dailyRes, growthRes] = await Promise.all([
      supabase.from('garden_state').select('longest_days').maybeSingle(),
      fetchVowSummaries(),
      supabase
        .from('measured_daily')
        .select('vow_id, actual_minutes')
        .eq('record_date', recordDateDaysAgo(1)),
      session ? loadGrowth(session.user.id) : Promise.resolve(null),
    ]);
    setTotals(totalsRes.data ?? null);
    setYesterdayMinutes(
      new Map((dailyRes.data ?? []).map((d) => [d.vow_id as string, d.actual_minutes as number])),
    );
    // 庭が引けんかった回は、前回表示した庭をそのまま残す(誓い一覧と同じ扱い)。
    // 高水位も無くて蓄積が分からんときだけ、読み込み失敗の面を出す
    const gardenOk = growthRes?.status === 'ok';
    const nextGrowth = gardenOk ? growthRes.growth : null;
    if (nextGrowth) setGrowth(nextGrowth);
    setGardenUnavailable(growthRes?.status === 'unavailable');

    if (vowsRes.error) {
      // 誓いが引けんかった回は、前回表示した誓いをそのまま残す。ここで空配列に
      // 上書きすると、通信断やスキーマ不一致のたびに計測中の誓いが全部消えて
      // 「まだ何も宣言しとらん」初回モードに化ける(見た目のデータ消失)。
      console.log(`[home] vows load failed: ${vowsRes.error.code} ${vowsRes.error.message}`);
    } else {
      const allVows = (vowsRes.data ?? []) as VowSummary[];
      // 挑戦中(3本の枠に数える)と卒業済み(数えない)を分ける。廃止はどちらにも出さない。
      const living = allVows.filter((v) => v.discontinued_on === null);
      const activeVows = living.filter((v) => v.graduated_on === null);
      const graduated = living.filter((v) => v.graduated_on !== null);
      setVows(activeVows);
      setGraduatedVows(graduated);
      setOfficialLabels(getAppLabels(living.map((v) => v.package_name)));
      // 累計はやめた誓いも卒業した誓いも含めた全体(消えない蓄積)。
      setTotalSavedMinutes(allVows.reduce((sum, v) => sum + v.saved_minutes, 0));

      // 卒業判定(卒業機能 §4)。窓もクエリも lib/graduation-check.ts に一本化しとる
      // ── 「時間の行き先」がこの画面と違う判定でアプリを並べてしまわんように。
      // 材料は端末内DBだけで、サーバーには問い合わせん。成立した誓いの行にだけ、
      // 静かなテキストリンクが1行増える。促しも通知もここには無い(五原則1)。
      const graduablePkgs = await findGraduablePackages(activeVows.map((v) => v.package_name));
      setGraduableVowIds(
        new Set(
          activeVows.filter((v) => graduablePkgs.has(v.package_name)).map((v) => v.vow_id),
        ),
      );
    }

    // §変更4: 前回表示時の状態と比べ、変化があれば差分演出+一行を用意し、現在状態を保存する。
    // 初回(スナップショットなし)は演出をスキップし、現在状態をそのまま保存する。
    // 引けんかった回は演出もスナップショットの更新もせん(前回見た状態を動かさない)。
    if (session && nextGrowth) {
      const prev = await loadLastSeen(session.user.id);
      const cats = changedCategories(prev, nextGrowth);
      setPrevGrowth(cats.length ? prev : null);
      setGardenCats(cats);
      // 差分アニメが流れる間は「とじる」を受け付けない(§6)
      diffUntil.current = cats.length ? Date.now() + diffDuration(cats) : 0;
      saveLastSeen(session.user.id, nextGrowth);
    } else {
      setPrevGrowth(null);
      setGardenCats([]);
      diffUntil.current = 0;
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
      let cancelled = false;
      (async () => {
        // 許可がなければ、まず目立つ開示([D])→ 許可([E])へ。開示を通過済みなら
        // [E] から再開する(§7)。「あとで」を選んだ人は連れ戻さず、観測なしの
        // 静かな案内を出す(例外系①)
        if (!isUsageStatsAvailable || !hasUsageAccess()) {
          if (await isPermissionDeferred()) {
            if (!cancelled) setGate('noAccess');
            return;
          }
          const seen = await isDisclosureSeen();
          if (!cancelled) router.replace(seen ? '/(app)/permission' : '/(app)/disclosure');
          return;
        }

        // オンボーディング未完(オンボーディング §0)。宣言が既にあれば完了の導出
        // (既存ユーザー・機種変の復元)。無ければ [F] 時間の行き先へ ── ただし
        // 履歴28日未満の端末は [F'] 待機モードへ(例外系③)
        if (session && !(await isOnboardingDone(session.user.id))) {
          const { count, error } = await supabase
            .from('measured_vows')
            .select('id', { count: 'exact', head: true })
            .is('discontinued_on', null);
          if (cancelled) return;
          if (!error && (count ?? 0) === 0) {
            const { availableDays } = measureBaselineWindow();
            router.replace(
              availableDays < BASELINE_MIN_DAYS
                ? { pathname: '/(app)/waiting', params: { days: String(availableDays) } }
                : { pathname: '/(app)/observe', params: { onboarding: '1' } },
            );
            return;
          }
          if (!error) await markOnboardingDone(session.user.id);
          // 引けんかった回(通信断など)はそのままホームを出し、次の focus で判定し直す
        }

        // 待機モード(§5): 28日に達した起動で [F]→[G] へ自然に誘導する。
        // push なので、選ばず戻ってきてもホームには帰れる(強制ではない)
        if (session && (await isWaitingMode(session.user.id))) {
          const { availableDays } = measureBaselineWindow();
          if (cancelled) return;
          if (availableDays >= BASELINE_MIN_DAYS) {
            await clearWaitingMode(session.user.id);
            if (!cancelled) {
              setGate('ready');
              loadAll().catch(() => {});
              router.push({ pathname: '/(app)/observe', params: { onboarding: '1' } });
            }
            return;
          }
          if (!cancelled) {
            setGate('waiting');
            setWaitingDays(Math.max(1, availableDays));
            loadAll().catch(() => {});
          }
          return;
        }

        if (!cancelled) {
          setGate('ready');
          loadAll().catch(() => {});
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [isDeveloper, session, loadAll, router])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    // finally で必ず畳む。途中で落ちると、引っぱって更新の輪が回ったまま止まらん
    try {
      if (session && !isDeveloper) await syncAll(session.user.id);
      await loadAll();
    } catch (e) {
      console.log(`[home] refresh failed: ${String(e)}`);
    } finally {
      setRefreshing(false);
    }
  };

  // ホームの庭窓は全幅・構図の 90%×縦100%。アスペクト 1.35:1 で高さが決まる(§変更1)。
  // 例: 幅390pt → 高さ≈289pt(縦画面844ptの約34%)。スクロール不要で全体が見える。
  const gardenHeight = Math.round(windowWidth / HOME_ASPECT);

  // 言語依存の表示はレンダー時に組む(メニューでの切替が開いたままの画面にも即時に効く)。
  const gardenNote = changeNote(gardenCats, lang);
  const unreadArticle = articlesState ? newestUnread(articlesState, lang) : null;

  // 開発者モードのホームに常設する読みものの帯(発火判定を通らないため常に表示)。
  const devStripArticle = previewStripArticle(lang);

  // observe への導線の重さは、誓い枠が空いとるかどうかで変わる。observe は宣言の
  // 唯一の入口やけん、枠が空いとる間は主導線(枠あり)、3本埋まったら詳細ビューへの
  // 脇道(枠なしの薄墨)へ引っ込む。枠は外れる方向にしか変わらん。
  const slotsOpen = vows.length < MAX_VOWS;

  const onGardenPress = () => {
    // 庭モード(絵巻)は週の節目(土曜・日曜)にのみ開く。閉扉中は静かに何もしない
    if (isEngawaOpen(new Date())) {
      router.push('/(app)/garden');
    }
  };

  // 閉じ際の儀式(§2・§3)。とじる → UIが退場し、庭に還り、障子が閉じ、
  // 1200ms でアプリがバックグラウンドへ移る。演出中の分岐は一切作らない。
  const onTojiruPress = () => {
    if (closing) return;
    // 差分アニメの再生中は無視する(§6)。押されなかったことにするだけで、何も出さない
    if (Date.now() < diffUntil.current) return;
    // 開発者モードと、端末のアニメーション無効化設定は演出を省いて即 E(§6)
    if (isDeveloper || reduceMotion) {
      exitToBackground();
      return;
    }
    setClosing(true);
    contentOpacity.value = withTiming(0, {
      duration: TOJIRU_TIMELINE.exit.duration,
      easing: Easing.out(Easing.cubic),
    });
  };

  // BackHandler.exitApp() はアプリを終了させず背面へ回すだけのこともある。
  // 復帰したときに障子が閉じたままにならんよう、前面に戻った時点で畳む(§7-8)。
  useEffect(() => {
    setClosing(false);
    contentOpacity.value = 1;
  }, [foreground, contentOpacity]);

  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  return (
    <View style={styles.root}>
      {/* 墨入れ(画面遷移の所作)。内容だけが据わり、固定フッター・障子の覆い・
          grain は動かさない。コールド起動では起動演出の覆いの下で流れ終わるので、
          目に入るのはサインイン直後や replace でホームへ還ったときだけ */}
      <Sumiire style={styles.container}>
      {/* 区間 A(§3): ホームのUIはここごとフェードアウトする。
          ヘッダー・数字・記録カード・とじるボタン自身が、まとめて退場する */}
      <Animated.ScrollView
        style={[styles.container, contentStyle]}
        contentContainerStyle={styles.content}
        pointerEvents={closing ? 'none' : 'auto'}
        scrollEnabled={!closing}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ヘッダー帯(看板)。和紙意匠は帯のコンポーネントに内包し、上端にアンカーする
            (和紙意匠 §2: 画面絶対座標での配置は禁止)。overflow: hidden で帯の外=
            庭以下の中央帯に紙片の裾がはみ出さないことを構造的に保証する */}
        <View style={styles.headerBlock}>
          <HeaderWashi />
          <View style={styles.header}>
            <Text style={styles.wordmark}>Yaranai</Text>
            {/* 金の界線: 題字のベースラインから三本線の手前まで真横に一本。
                行が baseline 揃えなので、縦位置は字から取れる(数値で当てない) */}
            <GoldRule />
            {/* §5.3: 「退出」を撤去し、ハンバーガー(三本線)へ差し替える */}
            <AppMenuButton />
          </View>

          {/* 理想(WHAT)は庭の直上に常設する。開発者モードでも同じ枠を使い、
              未入力でも高さを確保するので庭の描画開始位置は動かない */}
          <IdealHeader />
        </View>

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
        ) : gate === 'noAccess' ? (
          /* 観測なしの状態(オンボーディング §4 例外系①)。庭は出さず、静かな案内と
             開示([D])への再訪だけを置く。強制・警告色は使わない(五原則) */
          <View style={styles.empty}>
            <Text style={styles.quietNotice}>{t.home.noAccessNotice}</Text>
            <Pressable
              style={styles.quietLink}
              hitSlop={12}
              accessibilityRole="button"
              onPress={() => router.push('/(app)/disclosure')}
            >
              <Text style={styles.quietLinkText}>{t.home.noAccessLink}</Text>
            </Pressable>
          </View>
        ) : gate === 'waiting' ? (
          /* 待機モード(§5 例外系③)。世界観トーンの一枚。読みものの帯は生かす */
          <>
            <View style={styles.empty}>
              <Text style={styles.quietNotice}>{t.waiting.body(waitingDays)}</Text>
            </View>
            {unreadArticle && (
              <ReadingStrip
                style={styles.stripHome}
                article={unreadArticle}
                onPress={() => router.push(`/(app)/reading/${unreadArticle.id}`)}
              />
            )}
          </>
        ) : gate === 'checking' ? null : (
        <>
        {/* 庭: ホームの窓(静止画・全幅)。タップで絵巻へ */}
        {growth && growth.stones > 0 ? (
          <Pressable onPress={onGardenPress}>
            <HomeGarden growth={growth} height={gardenHeight} prevGrowth={prevGrowth} />
          </Pressable>
        ) : gardenUnavailable ? (
          /* 蓄積が引けんかった面。宣言前の空文言(emptyHeadline)は絶対に出さない ──
             機種変更の直後に圏外で開いた人に「ここから、変わる。」を見せたら、
             積んだものが無くなったと読める。喪失を連想させる語は使わず、
             いまは読めていないことだけを言い、もう一度だけ静かに置く(五原則) */
          <View style={styles.empty}>
            <Text style={styles.quietNotice}>{t.home.gardenUnavailable}</Text>
            <Pressable
              style={styles.quietLink}
              hitSlop={12}
              accessibilityRole="button"
              onPress={() => { loadAll().catch(() => {}); }}
            >
              <Text style={styles.quietLinkText}>{t.home.gardenRetry}</Text>
            </Pressable>
          </View>
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

        {/* 蓄積。宣言した直後は取り戻しが0で、ここが丸ごと消えるとアプリ行が庭に
            貼りついてしまう。誓いが1本でもある間は同じ枠を保ち、数字の代わりに
            「明日から出る」ことだけを薄墨で置く(枠の高さ=余白も一緒に残る) */}
        {totals && Math.round(totalSavedMinutes) > 0 ? (
          <View style={[styles.stats, unreadArticle && styles.statsUnderStrip]}>
            <Text style={styles.headline}>
              {t.home.savedHeadline(totals.longest_days, formatMinutes(totalSavedMinutes, lang))}
            </Text>
            {/* §変更4: 変化があったときだけ、過去形・数字なしの一行を添える */}
            {gardenNote && <Text style={styles.changeNote}>{gardenNote}</Text>}
          </View>
        ) : vows.length > 0 ? (
          <View style={[styles.stats, unreadArticle && styles.statsUnderStrip]}>
            <Text style={styles.pendingHeadline}>{t.home.savedPending}</Text>
          </View>
        ) : null}

        {/* 誓い */}
        <View style={styles.list}>
          {vows.map((vow) => {
            const actual = yesterdayMinutes.get(vow.vow_id);
            // 正式名が引けんときは宣言時に保存した名前をそのまま出す。
            const label = officialLabels[vow.package_name]?.trim() || vow.app_label;
            return (
              <View key={vow.vow_id} style={styles.rowGroup}>
                {/* 行ごと誓い別詳細(取り戻しログ)へ。「昨日の実測を待っています。」の
                    行も開ける(詳細画面は確定済みの過去だけを見せるけん、待ちとは独立)。
                    押下の返事は控えめな沈み込みだけ。リップルや色変化は付けない。 */}
                <Pressable
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() => router.push(`/(app)/vow/${vow.vow_id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <View style={styles.rowBody}>
                    <Text style={styles.label}>{label}</Text>
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
                  {/* 「押せ」ではなく「開いている」の印。主張しない */}
                  <Text style={styles.chevron}>›</Text>
                </Pressable>

                {/* 卒業の導線(卒業機能 §5-1)。直近7日、一度も開かれとらん誓いに
                    だけ静かに現れる一行。バッジも祝いも添えない ── 現れたこと自体が
                    知らせで、押すかどうかは本人が決める */}
                {graduableVowIds.has(vow.vow_id) && (
                  <Pressable
                    style={styles.graduate}
                    hitSlop={12}
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: '/(app)/graduate',
                        params: { vowId: vow.vow_id, packageName: vow.package_name, label },
                      })
                    }
                  >
                    <Text style={styles.graduateText}>{t.home.graduateLink}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}

          {/* 卒業済み(卒業機能 §5-1)。挑戦中の下に淡色で、名前と「卒業」だけ。
              日次の数字は出さない ── 取り戻しは合計値に含まれ続けとる(静けさ優先)。
              計測に戻す導線はここには置かない。ぶり返して「時間の行き先」に
              再浮上したときだけ、observe から静かに戻せる */}
          {graduatedVows.map((vow) => {
            const label = officialLabels[vow.package_name]?.trim() || vow.app_label;
            return (
              <View key={vow.vow_id} style={styles.graduatedRow}>
                <Text style={styles.graduatedLabel}>{label}</Text>
                <Text style={styles.graduatedMark}>{t.home.graduatedLabel}</Text>
              </View>
            );
          })}

          {/* 誓い枠が空いとる間だけ枠付き(木札)。3本埋まったら枠を外して薄墨の文字へ。
              文言・遷移先・タップ領域はどちらの状態でも変えん(演出も入れない) */}
          <Pressable
            style={slotsOpen ? styles.observe : styles.observeQuiet}
            onPress={() => router.push('/(app)/observe')}
          >
            <Text style={slotsOpen ? styles.observeText : styles.observeQuietText}>
              {t.home.observeLink}
            </Text>
          </Pressable>
        </View>
        </>
        )}

        {/* 閉じ際の儀式(§2)。縦スクロールの最下端に置く通常要素で、固定フッター・
            フローティングにはしない。ホーム以外の画面には置かない。
            誘導はしない: 促す文言も、印も、バッジも添えない(§5)。
            門の判定中(checking)は内容が無いけん、これも出さない */}
        {(isDeveloper || gate !== 'checking') && (
          <Pressable
            style={styles.tojiru}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t.home.tojiru}
            onPress={onTojiruPress}
          >
            <Text style={styles.tojiruText}>{t.home.tojiru}</Text>
          </Pressable>
        )}
      </Animated.ScrollView>
      </Sumiire>

      {/* 固定フッター(言い訳カード §3)。ホームでは「庭」が選択中。
          閉じ際の演出が始まったら、ホームのUIと一緒に沈める(覆いを遮らない) */}
      {!closing && <AppFooter active="garden" />}

      {/* A〜E の覆い。文字・数値・アイコンは一切持たない(§5) */}
      {closing && <TojiruCurtain growth={growth} />}

      {/* 紙肌 grain(和紙意匠 §7)。全画面を multiply で薄く覆う最前面レイヤー。
          意匠のうちこれだけは全画面オーバーレイが許される(§2 の例外) */}
      <GrainOverlay />
    </View>
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
  root: { flex: 1, backgroundColor: colors.kinari },
  container: { flex: 1, backgroundColor: colors.kinari },
  // 「とじる」がフッターの下に潜らないよう、フッターのぶんだけ余白を足す
  content: { paddingBottom: 80 + FOOTER_HEIGHT },

  // 「とじる」(§2): 中央寄せのテキストのみ。枠・背景・影は付けない。
  // カード末尾から 56 空け、タップ領域は最小 44dp 四方を満たす(高さ 44 + hitSlop)。
  tojiru: {
    marginTop: 56,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 色・字間は読みもの画面の「戻る」に揃える(薄墨・letterSpacing 3)
  tojiruText: { fontFamily: fonts.serif, fontSize: 13, color: colors.usuzumi, letterSpacing: 3 },
  // ヘッダー帯: 和紙意匠の親。意匠は絶対配置の背面レイヤーなので、
  // クリップしても文字・タップ領域には影響しない
  headerBlock: { overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 28,
    paddingTop: 64,
    paddingBottom: 20,
  },
  wordmark: { fontFamily: fonts.serif, fontSize: 16, letterSpacing: 6, color: colors.sumi },

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
  // 下の 40 は、累計ブロック非表示(誓いが1本もない)のときも帯がアプリ行に貼りつかないため。
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
  // 観測なし・待機モードの静かな案内(オンボーディング §4・§5)。警告色は使わない
  quietNotice: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 34,
    letterSpacing: 2,
    color: colors.sumi,
    textAlign: 'center',
    paddingHorizontal: 28,
  },
  quietLink: { marginTop: 28, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  quietLinkText: { fontFamily: fonts.serif, fontSize: 13, color: colors.usuzumi, letterSpacing: 3 },
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
  // 取り戻し待ちの一行。まだ起きとらんことを headline と同じ濃さでは言わんけん、
  // 一段小さく薄墨で置く(位置と余白だけ headline と同じ)
  pendingHeadline: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 32,
    letterSpacing: 2,
    color: colors.usuzumi,
    textAlign: 'center',
  },
  list: { gap: 28, paddingHorizontal: 28 },
  // 誓いの行と、その下に付きうる卒業の導線をひとまとめに。list の gap(28)は
  // 誓いと誓いの間にだけ効き、導線は行のすぐ下(12)に寄る
  rowGroup: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowPressed: { opacity: 0.6 },
  rowBody: { flex: 1, gap: 8 },
  // シェブロンは usuzumi より淡く(#8C8577 の55%)。テーマに同トーンが無いけん薄めた値
  chevron: { marginLeft: 12, fontSize: 15, lineHeight: 20, color: 'rgba(140,133,119,0.55)' },
  label: { fontFamily: fonts.serif, fontSize: 17, color: colors.sumi, letterSpacing: 1 },
  saved: { fontSize: 12, color: colors.usuzumi, letterSpacing: 1 },

  // 卒業の導線(§5-1): observe の declareLink に準ずる控えめなテキストリンク。
  // 枠・背景・印は付けない。行の右端に寄せて、数字の並びを乱さない
  graduate: { alignSelf: 'flex-end' },
  graduateText: { fontSize: 12, color: colors.shu, letterSpacing: 1 },

  // 卒業済みの行(§5-1): 淡色(薄墨)で名前と「卒業」だけ。タップ先も数字も無い
  graduatedRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  graduatedLabel: { fontFamily: fonts.serif, fontSize: 15, color: colors.usuzumi, letterSpacing: 1 },
  graduatedMark: { fontSize: 11, color: colors.usuzumi, letterSpacing: 2 },

  // 誓い枠が空いとる間: 極細の実線枠(木札)。破線は「仮置き」の記号に見えるけん使わん。
  observe: {
    marginTop: 8,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(43,39,35,0.22)', // sumi #2B2723 の22%
  },
  observeText: { fontFamily: fonts.serif, fontSize: 14, color: colors.sumi, letterSpacing: 4 },

  // 3本埋まったら: 枠を外し薄墨テキストへ。
  // paddingVertical はタップ領域確保のため維持する(見た目は文字だけ)。
  observeQuiet: {
    marginTop: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  observeQuietText: {
    fontFamily: fonts.serif,
    fontSize: 13,
    color: colors.usuzumi,
    letterSpacing: 4,
  },
});
