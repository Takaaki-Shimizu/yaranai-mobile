// ハンバーガーメニュー(実装仕様書 §5.3)。ヘッダー右上の「退出」を差し替える入口。
// 項目は上から: 理想を入力 / 読みもの / ログアウト(罫線で区切り最下部)。
// 設定は v1 では中身が薄いため項目ごと省略(§5.3)。
//
// ログアウトは確認ダイアログ必須。ローカルデータ(庭・記事状態)は消さない:
// supabase.auth.signOut() は認証ストレージだけを消し、庭の高水位(garden-high-water:*)や
// 記事状態(yaranai.articles.state.v1)には触れないため、再ログインで無傷に戻る。

import { Modal, Pressable, View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@yaranai/core';
import { supabase } from '../lib/supabase';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function AppMenu({ visible, onClose }: Props) {
  const router = useRouter();

  const confirmLogout = () => {
    Alert.alert(
      'ログアウトしますか?',
      '次に開くときは、もう一度ログインが必要です。',
      [
        { text: 'やめる', style: 'cancel' },
        {
          text: 'ログアウト',
          style: 'destructive',
          onPress: () => {
            onClose();
            // ローカルデータは消さない(§5.3)。認証セッションだけを終える。
            supabase.auth.signOut();
          },
        },
      ],
    );
  };

  const goReading = () => {
    onClose();
    router.push('/(app)/reading');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* 背景タップで閉じる。演出は控えめ(フェードのみ) */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* 理想を入力: 宣言機能の既存予定エントリ。未実装のためプレースホルダ(§5.3) */}
          <View style={[styles.item, styles.itemDisabled]}>
            <Text style={[styles.itemText, styles.itemTextDisabled]}>理想を入力</Text>
          </View>

          <Pressable style={styles.item} onPress={goReading}>
            <Text style={styles.itemText}>読みもの</Text>
          </Pressable>

          {/* ログアウトは罫線で区切って最下部。表記は世界観で塗らない機能語 */}
          <Pressable style={[styles.item, styles.logout]} onPress={confirmLogout}>
            <Text style={styles.itemText}>ログアウト</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 39, 35, 0.28)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  sheet: {
    marginTop: 96,
    marginRight: 16,
    minWidth: 180,
    backgroundColor: colors.kinari,
    borderWidth: 1,
    borderColor: colors.suna,
    paddingVertical: 6,
  },
  item: { paddingVertical: 16, paddingHorizontal: 24 },
  itemDisabled: { opacity: 1 },
  itemText: { fontFamily: fonts.serif, fontSize: 15, color: colors.sumi, letterSpacing: 2 },
  itemTextDisabled: { color: colors.usuzumi },
  logout: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.suna,
  },
});
