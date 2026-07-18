// 記事画面(実装仕様書 §5.2)。生成り地・明朝・本文markdownをレンダリング。
// ヘッダーは戻るのみ(共有・目次・進捗バーは置かない)。
// 記事末尾に他記事への導線を置かない(原則4): 本文が終わったら余白で終わる。
// 既読の確定: 記事画面を開いた時点で readAt を記録する(スクロール率などの読了判定はしない)。

import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts } from '@yaranai/core';
import { getArticle } from '../../../lib/articles/registry';
import { parseArticleBody } from '../../../lib/articles/markdown';
import { recordRead } from '../../../lib/articles/storage';

export default function ArticleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const article = id ? getArticle(id) : undefined;

  // 開いた時点で既読(§5.2)。単調ガード(state.ts)で二度目以降は何もしない。
  useEffect(() => {
    if (article) recordRead(article.id, new Date().toISOString());
  }, [article]);

  // 未知の id は静かにホームへ戻す。
  if (!article) return <Redirect href="/(app)" />;

  const blocks = parseArticleBody(article.body);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>戻る</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{article.title}</Text>
        {blocks.map((block, i) =>
          block.type === 'h2' ? (
            <Text key={i} style={styles.h2}>
              {block.text}
            </Text>
          ) : (
            <Text key={i} style={styles.p}>
              {block.text}
            </Text>
          ),
        )}
        {/* 本文が終わったら余白で終わる。次の記事・おすすめは置かない(原則4) */}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.kinari },
  header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 8 },
  back: { fontFamily: fonts.serif, fontSize: 13, color: colors.usuzumi, letterSpacing: 3 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 28, paddingTop: 24, paddingBottom: 120 },
  title: {
    fontFamily: fonts.serif,
    fontSize: 22,
    lineHeight: 36,
    letterSpacing: 2,
    color: colors.sumi,
    marginBottom: 32,
  },
  h2: {
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 32,
    letterSpacing: 2,
    color: colors.sumi,
    marginTop: 32,
    marginBottom: 12,
  },
  p: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 30,
    letterSpacing: 1,
    color: colors.sumi,
    marginBottom: 20,
  },
});
