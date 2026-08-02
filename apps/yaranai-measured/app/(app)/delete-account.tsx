// アカウント削除の確認画面(設定+お問い合わせ スペック §5)。
//
// モーダルではなく画面遷移(§5.2)── 誤操作で不可逆な処理が走るのを避ける。
// 文言は事実だけを述べる。「本当によろしいですか?」「もったいないですよ」の類の
// 引き止めは書かない(§5.3)。非強制はロック機能を持たない理由と同じ原則であり、
// 退出時にも適用される。「庭は最初からになります」は、このプロダクトの中心的な
// 約束(消えない蓄積)の裏返しやけん必ず明示する。
//
// colors.shu は使わない。削除の実行ボタンも墨のまま。

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, useSession } from '@yaranai/core';
import { deleteAccount } from '../../lib/account-deletion';
import { useT } from '../../lib/i18n/context';
import { Sumiire, useSumiireRouter } from '../../components/Sumiire';

export default function DeleteAccount() {
  const router = useSumiireRouter();
  const session = useSession();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const runDelete = async () => {
    if (busy || !session) return;
    setBusy(true);
    setFailed(false);
    const { ok } = await deleteAccount(session.user.id);
    if (!ok) {
      // 失敗したらこの画面に留まる(§5.4)。中途半端にサインアウトさせない
      setBusy(false);
      setFailed(true);
      return;
    }
    router.replace('/(auth)/sign-in');
  };

  return (
    <Sumiire style={styles.container}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t.deleteAccount.title}</Text>

        <View style={styles.section}>
          <Text style={styles.lede}>{t.deleteAccount.lede}</Text>
          <View style={styles.list}>
            {t.deleteAccount.items.map((item) => (
              <Text key={item} style={styles.listItem}>
                ・ {item}
              </Text>
            ))}
          </View>
          <Text style={styles.note}>{t.deleteAccount.note}</Text>
        </View>

        {failed && <Text style={styles.failed}>{t.deleteAccount.failed}</Text>}

        <View style={styles.actions}>
          <Pressable
            style={[styles.confirm, busy && styles.confirmBusy]}
            disabled={busy}
            accessibilityRole="button"
            onPress={runDelete}
          >
            <Text style={styles.confirmText}>{t.deleteAccount.confirm}</Text>
          </Pressable>
          <Pressable
            style={styles.back}
            disabled={busy}
            hitSlop={12}
            accessibilityRole="button"
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>{t.deleteAccount.back}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Sumiire>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.kinari },
  content: { paddingHorizontal: 32, paddingTop: 96, paddingBottom: 80 },
  title: {
    fontFamily: fonts.serif,
    fontSize: 20,
    letterSpacing: 4,
    color: colors.sumi,
    textAlign: 'center',
  },
  section: { marginTop: 48 },
  lede: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 30,
    letterSpacing: 1,
    color: colors.sumi,
  },
  list: { marginTop: 12, gap: 6 },
  listItem: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 28,
    letterSpacing: 1,
    color: colors.sumi,
  },
  note: {
    marginTop: 28,
    fontSize: 13,
    lineHeight: 24,
    letterSpacing: 1,
    color: colors.usuzumi,
  },
  failed: {
    marginTop: 32,
    fontSize: 13,
    lineHeight: 22,
    letterSpacing: 1,
    color: colors.usuzumi,
    textAlign: 'center',
  },
  actions: { marginTop: 56, gap: 12 },
  // 実行ボタンも朱は使わない。墨の細枠だけで「押せる」ことを示す
  confirm: {
    borderWidth: 1,
    borderColor: colors.sumi,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBusy: { opacity: 0.4 },
  confirmText: {
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.sumi,
    letterSpacing: 6,
  },
  back: { paddingVertical: 12, alignItems: 'center' },
  backText: { fontFamily: fonts.serif, fontSize: 13, color: colors.usuzumi, letterSpacing: 3 },
});
