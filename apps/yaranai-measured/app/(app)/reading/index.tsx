// 読みもの一覧(実装仕様書 §5.4)。発火済みの全記事を発火が新しい順に縦一列。
// 各行: タイトル(明朝)+ 未読なら右端に点。日付・カテゴリ・サムネは出さない。
// 空状態: 「まだ、読みものはありません。」の1行のみ。何も促さない。

import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, fonts } from '@yaranai/core';
import { loadArticlesState } from '../../../lib/articles/storage';
import { firedArticles, type ArticleListItem } from '../../../lib/articles/select';

export default function ReadingList() {
  const router = useRouter();
  const [items, setItems] = useState<ArticleListItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadArticlesState().then((state) => {
        if (!active) return;
        setItems(firedArticles(state));
        setLoaded(true);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>読みもの</Text>

      <View style={styles.list}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            style={styles.row}
            onPress={() => router.push(`/(app)/reading/${item.id}`)}
          >
            <Text style={styles.rowTitle}>{item.title}</Text>
            {item.unread && <View style={styles.dot} />}
          </Pressable>
        ))}

        {loaded && items.length === 0 && (
          <Text style={styles.empty}>まだ、読みものはありません。</Text>
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
