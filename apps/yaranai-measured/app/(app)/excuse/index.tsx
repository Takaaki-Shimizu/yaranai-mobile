// 言い訳カード(指示書 §4.1 / §4.3)。フッターの3つめのタブ。
//
// 未作成のときは夜色を使わず、通常の生成り地に世界観の一文と「宣言をつくる」だけを置く。
// 煽り・催促・通知は一切なし(§4.1)。
//
// 作成済みのときは 9:16 のカードを大きく出す。カードをタップすると余計なものを畳んで
// 全画面になる ── 対面提示はこの状態で行う(§4.3)。
// 「戻る」は既存の語彙・体裁に準拠する。「とじる」はホーム最下部の閉じ際の儀式だけの語で、
// ここでは使わない(一語一義)。

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSession, colors, fonts } from '@yaranai/core';

import { AppFooter, FOOTER_HEIGHT } from '../../../components/AppFooter';
import { ExcuseCardView } from '../../../components/excuse/ExcuseCardView';
import type { CardContent } from '../../../components/excuse/bake';
import { shareCard } from '../../../components/excuse/share';
import { CARD_SIZES, type CardSize } from '../../../lib/excuse/card-spec';
import { formatDeclaredOn } from '../../../lib/excuse/format';
import { consumeRevealPending } from '../../../lib/excuse/reveal-flag';
import { loadCurrentDeclaration, type ExcuseDeclaration } from '../../../lib/excuse/storage';
import { EXCUSE_CARD_URL } from '../../../lib/excuse/url';
import { splitExcuseLines } from '../../../lib/excuse/validate';
import { useLang, useT } from '../../../lib/i18n/context';
import { useReduceMotion } from '../../../lib/use-reduce-motion';

export default function ExcuseTab() {
  const session = useSession();
  const router = useRouter();
  const t = useT();
  const { lang } = useLang();
  const reduceMotion = useReduceMotion();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const userId = session?.user?.id;

  // undefined = 読み込み中 / null = 未作成
  const [declaration, setDeclaration] = useState<ExcuseDeclaration | null | undefined>(undefined);
  // 作成直後の一度だけ完成演出を流す(§4.2-3)
  const [revealing, setRevealing] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [choosingSize, setChoosingSize] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      // 儀式を終えて戻ってきたときだけ印が立っている。印は取ると消える
      if (consumeRevealPending()) {
        setPresenting(false);
        setChoosingSize(false);
        setMessage('');
        setRevealing(true);
      }
      if (!userId) {
        setDeclaration(null);
        return;
      }
      let alive = true;
      loadCurrentDeclaration(userId).then((v) => {
        if (alive) setDeclaration(v);
      });
      return () => {
        alive = false;
      };
    }, [userId]),
  );

  const lines = useMemo(
    () => (declaration ? splitExcuseLines(declaration.whatText) : []),
    [declaration],
  );

  // カードに刷る文言。預かりの一文だけがサイズで行組みを変える
  const contentFor = useCallback(
    (size: CardSize): CardContent | null =>
      declaration
        ? {
            lines,
            date: formatDeclaredOn(declaration.declaredOn, lang),
            custody: t.excuse.card.custody[size],
            wordmark: t.excuse.card.wordmark,
            qrLabel: t.excuse.card.qrLabel,
            url: EXCUSE_CARD_URL,
          }
        : null,
    [declaration, lines, lang, t],
  );

  const storyContent = contentFor('story');

  const onRevealEnd = useCallback(() => setRevealing(false), []);

  // reduce motion のときは演出なしで最終状態を即時表示する(§4.2-4)。
  // 端末の設定は非同期に読めるので、判明した時点で畳む(ExcuseCardView 側で
  // 3層とも不透明度1へ落ちる)。
  useEffect(() => {
    if (reduceMotion && revealing) onRevealEnd();
  }, [reduceMotion, revealing, onRevealEnd]);

  const onShare = async (size: CardSize) => {
    const content = contentFor(size);
    if (!userId || !content || busy) return;
    setBusy(true);
    setMessage('');
    const result = await shareCard(userId, size, content);
    setBusy(false);
    setChoosingSize(false);
    if (result === 'unavailable') setMessage(t.excuse.shareUnavailable);
    else if (result === 'failed') setMessage(t.excuse.shareFailed);
  };

  // ---- 読み込み中 --------------------------------------------------------
  if (declaration === undefined) {
    return (
      <View style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.usuzumi} />
        </View>
        <AppFooter active="excuse" />
      </View>
    );
  }

  // ---- 未作成(空状態 §4.1) ---------------------------------------------
  if (!declaration) {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>{t.excuse.title}</Text>
        <View style={styles.center}>
          <Text style={styles.emptyLede}>{t.excuse.emptyLede}</Text>
          <Pressable style={styles.action} onPress={() => router.push('/(app)/excuse/new')}>
            <Text style={styles.actionText}>{t.excuse.create}</Text>
          </Pressable>
        </View>
        <AppFooter active="excuse" />
      </View>
    );
  }

  // ---- 対面提示(全画面) ------------------------------------------------
  if (presenting) {
    return (
      <View style={styles.root}>
        <View style={styles.presentBody}>
          {storyContent && (
            <ExcuseCardView
              content={storyContent}
              width={windowWidth}
              height={windowHeight - 64}
              reveal={false}
            />
          )}
        </View>
        <Pressable style={styles.back} onPress={() => setPresenting(false)}>
          <Text style={styles.backText}>{t.excuse.back}</Text>
        </Pressable>
      </View>
    );
  }

  // ---- カード表示 --------------------------------------------------------
  // 演出の間は、まわりの文言もボタンも伏せる。立ち上がるのはカードだけ。
  // 場所は空けたまま伏せる ── 演出の途中で版面の寸法が変わると、カードを焼き直して
  // しまい、光の立ち上がりが途切れるため。
  const hidden = revealing && styles.hidden;
  const cardHeight = windowHeight - 210 - FOOTER_HEIGHT;

  return (
    <View style={styles.root}>
      <Text style={[styles.title, hidden]}>{t.excuse.title}</Text>

      <View style={styles.cardBody}>
        {storyContent ? (
          // タップの意味は状態で変わる: 演出中はスキップ、掲げたあとは対面提示へ
          <ExcuseCardView
            content={storyContent}
            width={windowWidth - 40}
            height={cardHeight}
            reveal={revealing}
            onRevealEnd={onRevealEnd}
            onPress={() => setPresenting(true)}
          />
        ) : (
          <Text style={styles.note}>{t.excuse.buildFailed}</Text>
        )}
      </View>

      <View style={[styles.actions, hidden]} pointerEvents={revealing ? 'none' : 'auto'}>
          {choosingSize ? (
            // サイズ選択(§4.3)。2つと「やめる」だけ。おすすめも既定も置かない
            <View style={styles.sizeRow}>
              {CARD_SIZES.map((size) => (
                <Pressable key={size} style={styles.sizeItem} disabled={busy} onPress={() => onShare(size)}>
                  <Text style={styles.actionText}>
                    {size === 'square' ? t.excuse.shareSquare : t.excuse.shareStory}
                  </Text>
                </Pressable>
              ))}
              <Pressable style={styles.sizeItem} onPress={() => setChoosingSize(false)}>
                <Text style={styles.secondaryText}>{t.excuse.shareCancel}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Pressable style={styles.action} onPress={() => setChoosingSize(true)}>
                <Text style={styles.actionText}>{t.excuse.share}</Text>
              </Pressable>
              {/* 差し替えは自由(回数制限なし)。作成と同じ儀式を必ず通る(§2-1) */}
              <Pressable style={styles.secondary} onPress={() => router.push('/(app)/excuse/new')}>
                <Text style={styles.secondaryText}>{t.excuse.replace}</Text>
              </Pressable>
            </>
          )}
          {message !== '' && <Text style={styles.note}>{message}</Text>}
      </View>

      {/* フッターも演出の間は伏せる。掲げ終わってから、また導線に戻る */}
      {!revealing && <AppFooter active="excuse" />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.kinari },
  title: {
    fontFamily: fonts.serif,
    fontSize: 20,
    letterSpacing: 4,
    color: colors.sumi,
    textAlign: 'center',
    paddingTop: 64,
    paddingBottom: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: FOOTER_HEIGHT,
    gap: 48,
  },
  emptyLede: {
    fontFamily: fonts.serif,
    fontSize: 17,
    lineHeight: 34,
    letterSpacing: 2,
    color: colors.sumi,
    textAlign: 'center',
  },
  cardBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  presentBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { paddingBottom: FOOTER_HEIGHT + 12, alignItems: 'center', gap: 4 },
  // 演出の間の伏せ方。場所は空けたまま見えなくする(寸法を動かさない)
  hidden: { opacity: 0 },
  action: { paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  actionText: { fontFamily: fonts.serif, fontSize: 15, color: colors.sumi, letterSpacing: 5 },
  secondary: { paddingVertical: 10, alignItems: 'center' },
  secondaryText: { fontFamily: fonts.serif, fontSize: 13, color: colors.usuzumi, letterSpacing: 3 },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sizeItem: { paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  back: { paddingVertical: 16, alignItems: 'center' },
  backText: { fontFamily: fonts.serif, fontSize: 13, color: colors.usuzumi, letterSpacing: 3 },
  note: { fontSize: 12, lineHeight: 22, color: colors.usuzumi, textAlign: 'center', marginTop: 8 },
});
