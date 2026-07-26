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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t.reading.listTitle}</Text>

      <View style={styles.list}>
        {sections.standing.map(renderRow)}

        {/* standing と conditional の間の罫線1本(v1.1 §5.2)。
            片方しか無いときは区切るものが無いため出さない */}
        {sections.standing.length > 0 && sections.conditional.length > 0 && (
          <View style={styles.divider} />
        )}

        {sections.conditional.map(renderRow)}

        {loaded && isEmpty && <Text style={styles.empty}>{t.reading.empty}</Text>}
      </View>

      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>{t.reading.back}</Text>
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
    marginBottom: 40,
  },
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
  // 節の罫線(v1.1 §5.2)。行の下罫線と同じ1px・砂色。上下に息をつける余白だけ足す。
  divider: { height: 1, backgroundColor: colors.suna, marginVertical: 14 },
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
