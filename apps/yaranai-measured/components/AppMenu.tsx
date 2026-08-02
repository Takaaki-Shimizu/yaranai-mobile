// ハンバーガーメニュー(実装仕様書 §5.3)。ヘッダー右上の「退出」を差し替える入口。
//
// 入口(三本線)は AppMenuButton として同じファイルに置き、フッターを持つ3画面
// (庭/読みもの/言い訳カード)と時間の行き先の右上に同じ形で出す ── 理想も言語も
// ログアウトも画面を選ばない設定なので、庭に戻らないと開けないのは、ただの遠回りになる。
//
// 項目は上から: 理想を入力 / 言語(罫線で区切る) / ログアウト(罫線で区切り最下部)。
//
// オンボーディング中(hideIdeal)は「理想を入力」を出さない。理想は宣言を終えた後に
// 一度通る画面で書くもので、まだ何も宣言していない時点で「理想」だけ先に問うと、
// 順路が二本に割れる。この時点で要るのは、読める言語に替えることと、入り直すこと ──
// 言語とログアウトだけを残す。
//
// 「読みもの」はフッターの2つめのタブが持つのでここには置かない。理想は庭の掛け軸
// (IdealHeader)のタップでも入れるが、掛け軸は未入力だと何も出ない無地の枠で、そこが
// 押せると気づけない。入口の分かる場所として、この項目を残しておく。
//
// 言語の行は「日本語 / English」の2語を並べ、現在の言語を墨色・もう一方を薄墨で示す。
// タップで即時切替(確認なし)。メニューは閉じない ── 項目名がその場で切り替わるのが
// いちばん静かなフィードバックになる。
//
// ログアウトは確認ダイアログ必須。ローカルデータ(庭・記事状態)は消さない:
// supabase.auth.signOut() は認証ストレージだけを消し、庭の高水位(garden-high-water:*)や
// 記事状態(yaranai.articles.state.v1)には触れないため、再ログインで無傷に戻る。
// 言語(yaranai.language.v1)も同様に残る。

import { useEffect, useRef, useState } from 'react';
import {
  Modal, Pressable, Text, View, StyleSheet, Alert, Animated, Easing,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { colors, fonts } from '@yaranai/core';
import { supabase } from '../lib/supabase';
import { useLang, useT } from '../lib/i18n/context';
import { useSumiireRouter } from './Sumiire';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** オンボーディング中だけ true。「理想を入力」を伏せ、言語とログアウトだけを出す */
  hideIdeal?: boolean;
};

export function AppMenu({ visible, onClose, hideIdeal = false }: Props) {
  const router = useSumiireRouter();
  const { lang, setLang } = useLang();
  const t = useT();

  // 開き方(見せ方 案B)。Modal 標準のフェードだけだと面が平坦に出るため、
  // ハンバーガーのある右上を原点に、わずかに縮んだ状態から開く。
  // 閉じは開きより速く(140ms → 100ms)。動きに気づかせず、立体だけ残す。
  // 閉じ切ってから Modal を外したいので、visible とは別に mounted を持つ。
  const [mounted, setMounted] = useState(visible);
  const open = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(open, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(open, {
      toValue: 0,
      duration: 100,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, open]);

  const confirmLogout = () => {
    Alert.alert(t.menu.logoutTitle, t.menu.logoutBody, [
      { text: t.menu.logoutCancel, style: 'cancel' },
      {
        text: t.menu.logoutConfirm,
        style: 'destructive',
        onPress: () => {
          onClose();
          // ローカルデータは消さない(§5.3)。認証セッションだけを終える。
          supabase.auth.signOut();
        },
      },
    ]);
  };

  const goIdeal = () => {
    onClose();
    router.push('/(app)/ideal');
  };

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      {/* 背景タップで閉じる。地の暗みも面と一緒に立ち上げる */}
      <Animated.View style={[styles.backdrop, { opacity: open }]}>
        <Pressable style={styles.backdropFill} onPress={onClose}>
          {/* 影は角丸で切られると出ないため、影を持つ層と中身を切る層を分ける */}
          <Animated.View
            style={[
              styles.sheetShadow,
              {
                transform: [
                  { scale: open.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
                ],
              },
            ]}
          >
            <Pressable style={styles.sheet} onPress={() => {}}>
              {/* 上辺の内側ハイライト。紙に厚みがあるように見せる1px(見せ方 案A) */}
              <View pointerEvents="none" style={styles.topHighlight} />

              {/* 理想を入力(§5.3)。庭の掛け軸タップと同じ編集画面へ入る */}
              {!hideIdeal && (
                <Pressable style={styles.item} onPress={goIdeal}>
                  <Text style={styles.itemText}>{t.menu.ideal}</Text>
                </Pressable>
              )}

              {/* 言語。両言語の名前をそれぞれの言語で並べる(いま読めない言語の人にも
                  自分の言語が見つかるように)。選択中は墨、他方は薄墨 */}
              {/* 項目の間はすべて同じ1本の罫線で区切る(ここだけ無いと束ねて見える)。
                  先頭に来たときは区切る相手がおらんけん、罫線は引かない */}
              <View style={[styles.langRow, !hideIdeal && styles.separated]}>
                <Pressable onPress={() => setLang('ja')} hitSlop={8}>
                  <Text style={[styles.langText, lang === 'ja' && styles.langActive]}>日本語</Text>
                </Pressable>
                <Text style={styles.langDivider}>/</Text>
                <Pressable onPress={() => setLang('en')} hitSlop={8}>
                  <Text style={[styles.langText, lang === 'en' && styles.langActive]}>English</Text>
                </Pressable>
              </View>

              {/* ログアウトは罫線で区切って最下部。表記は世界観で塗らない機能語 */}
              <Pressable style={[styles.item, styles.separated]} onPress={confirmLogout}>
                <Text style={styles.itemText}>{t.menu.logout}</Text>
              </Pressable>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

/**
 * メニューの入口(三本線)。開閉の状態はここで持つので、置く側は場所を決めるだけでよい。
 * 庭はヘッダー帯の行の中に流し込み、読みもの・言い訳カードは見出しの行の右端へ
 * style で絶対配置する ── 画面ごとに三本線の寸法や色が散らないよう、絵はここにだけ置く。
 */
export function AppMenuButton(
  { style, hideIdeal }: { style?: StyleProp<ViewStyle>; hideIdeal?: boolean },
) {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <>
      <Pressable
        style={style}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t.menu.a11yLabel}
        onPress={() => setOpen(true)}
      >
        <View style={styles.hamburger}>
          <View style={styles.hbLine} />
          <View style={styles.hbLine} />
          <View style={styles.hbLine} />
        </View>
      </Pressable>
      <AppMenu visible={open} onClose={() => setOpen(false)} hideIdeal={hideIdeal} />
    </>
  );
}

// 面の紙。地(生成り)と同色だと背景に沈んでのっぺり見えるため、半段だけ明るい紙を使う。
const WASHI = '#F6F1E6';

const styles = StyleSheet.create({
  // 三本線(§5.3)。20x14 の中に 1px の線を3本。色は薄墨 ── 看板より前に出させない
  hamburger: { width: 20, height: 14, justifyContent: 'space-between' },
  hbLine: { height: 1, backgroundColor: colors.usuzumi },

  backdrop: { flex: 1, backgroundColor: 'rgba(43, 39, 35, 0.28)' },
  backdropFill: { flex: 1, justifyContent: 'flex-start', alignItems: 'flex-end' },
  // 影の層。角丸で切らない(overflow: hidden を置くと影ごと消える)。
  // 影は墨を薄く落とした程度に留める ── 濃いと material のカードに見えてしまう。
  sheetShadow: {
    marginTop: 96,
    marginRight: 16,
    borderRadius: 12,
    backgroundColor: WASHI,
    // ハンバーガーのある右上を原点に開く(見せ方 案B)
    transformOrigin: 'top right',
    shadowColor: colors.sumi,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  sheet: {
    minWidth: 180,
    backgroundColor: WASHI,
    borderWidth: 1,
    borderColor: colors.suna,
    // 直角だと硬く出るため、角は控えめに丸める(和紙の切り口くらいの緩さ)
    borderRadius: 12,
    // 角丸の外へ項目のタップ範囲がはみ出さないよう内側で切る
    overflow: 'hidden',
    paddingVertical: 6,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  item: { paddingVertical: 16, paddingHorizontal: 24 },
  itemText: { fontFamily: fonts.serif, fontSize: 15, color: colors.sumi, letterSpacing: 2 },
  separated: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.suna,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  langText: { fontFamily: fonts.serif, fontSize: 13, color: colors.usuzumi, letterSpacing: 2 },
  langActive: { color: colors.sumi },
  langDivider: { fontFamily: fonts.serif, fontSize: 13, color: colors.suna },
});
