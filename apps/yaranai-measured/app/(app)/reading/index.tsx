// 読みもの一覧(実装仕様書 §5.4 / v1.1 §5.2)。
// standing(羅針盤)の記事を常に最上部に固定し、罫線を1本挟んで、
// conditional の記事を発火が新しい順に縦一列。standing 同士は registry の定義順。
// 各行: タイトル(明朝)+ 未読なら右端に点。日付・カテゴリ・サムネは出さない。
// 空状態: 「まだ、読みものはありません。」の1行のみ。何も促さない。

import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, fonts } from '@yaranai/core';
import { useIsDeveloper } from '../../../lib/developer';
import { loadArticlesState } from '../../../lib/articles/storage';
import {
  articleSections,
  previewSections,
  type ArticleListItem,
  type ArticleListSections,
} from '../../../lib/articles/select';
import { useLang, useT } from '../../../lib/i18n/context';
import { AppFooter, FOOTER_HEIGHT } from '../../../components/AppFooter';
import { AppMenuButton } from '../../../components/AppMenu';

const EMPTY_SECTIONS: ArticleListSections = { standing: [], conditional: [] };

export default function ReadingList() {
  const router = useRouter();
  const isDeveloper = useIsDeveloper();
  const { lang } = useLang();
  const t = useT();
  const [sections, setSections] = useState<ArticleListSections>(EMPTY_SECTIONS);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // 開発者モードは計測しないため発火状態を持たない。登録簿の全記事を常に見せる。
      if (isDeveloper) {
        setSections(previewSections(lang));
        setLoaded(true);
        return;
      }
      let active = true;
      loadArticlesState().then((state) => {
        if (!active) return;
        setSections(articleSections(state, lang));
        setLoaded(true);
      });
      return () => {
        active = false;
      };
    }, [isDeveloper, lang]),
  );

  const isEmpty = sections.standing.length === 0 && sections.conditional.length === 0;

  const renderRow = (item: ArticleListItem) => (
    <Pressable
      key={item.id}
      style={styles.row}
      onPress={() => router.push(`/(app)/reading/${item.id}`)}
    >
      <Text style={styles.rowTitle}>{item.title}</Text>
      {item.unread && <View style={styles.dot} />}
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t.reading.listTitle}</Text>

        <View style={styles.list}>
          {sections.standing.map(renderRow)}

          {/* standing と conditional の間の罫線1本(v1.1 §5.2)。
              その罫線は standing 最終行の下罫線が兼ねる ── ここに線を足すと2本になって
              余計に見えるため、足すのは息をつける余白だけ。
              片方しか無いときは区切るものが無いので余白も出さない */}
          {sections.standing.length > 0 && sections.conditional.length > 0 && (
            <View style={styles.sectionGap} />
          )}

          {sections.conditional.map(renderRow)}

          {loaded && isEmpty && <Text style={styles.empty}>{t.reading.empty}</Text>}
        </View>

        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>{t.reading.back}</Text>
        </Pressable>
      </ScrollView>

      {/* メニュー(§5.3)。庭と同じ右上に、見出しの行と同じ高さで置く。
          一覧と一緒に流れると入口が消えるので、スクロールの外に固定する */}
      <AppMenuButton style={styles.menu} />

      {/* 固定フッター(言い訳カード §3)。読みものは3タブの真ん中 */}
      <AppFooter active="reading" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.kinari },
  container: { flex: 1, backgroundColor: colors.kinari },
  content: { paddingHorizontal: 28, paddingTop: 64, paddingBottom: 80 + FOOTER_HEIGHT },
  title: {
    fontFamily: fonts.serif,
    fontSize: 20,
    letterSpacing: 4,
    color: colors.sumi,
    textAlign: 'center',
    marginBottom: 40,
  },
  // 三本線の置き場所。見出し(paddingTop 64・20pt)の行の中央に来るよう、
  // 上端から 64 の位置に見出し1行ぶんの箱を置いて、その中で縦中央に据える
  menu: { position: 'absolute', top: 64, right: 28, height: 28, justifyContent: 'center' },
  list: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.suna,
  },
  rowTitle: { fontFamily: fonts.serif, fontSize: 16, color: colors.sumi, letterSpacing: 1, flex: 1 },
  // 未読の点(6px・生成りに沈む茶灰。モックの --tensen)
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#A9A28B', marginLeft: 12 },
  // 節の間(v1.1 §5.2)。区切りの線は standing 最終行の下罫線が担うので、ここは余白のみ。
  sectionGap: { height: 24 },
  empty: {
    fontSize: 13,
    lineHeight: 24,
    color: colors.usuzumi,
    textAlign: 'center',
    marginTop: 24,
    letterSpacing: 1,
  },
  back: { marginTop: 48, paddingVertical: 10, alignItems: 'center' },
  backText: { fontFamily: fonts.serif, fontSize: 13, color: colors.usuzumi, letterSpacing: 3 },
});
