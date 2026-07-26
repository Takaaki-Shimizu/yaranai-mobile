// ハンバーガーメニュー(実装仕様書 §5.3)。ヘッダー右上の「退出」を差し替える入口。
// 項目は上から: 理想を入力 / 読みもの / 言語(罫線で区切る) / ログアウト(罫線で区切り最下部)。
// 設定は v1 では中身が薄いため項目ごと省略(§5.3)。言語だけはここに置く
// (設定画面を新設するほどの項目数がないため)。
//
// 言語の行は「日本語 / English」の2語を並べ、現在の言語を墨色・もう一方を薄墨で示す。
// タップで即時切替(確認なし)。メニューは閉じない ── 項目名がその場で切り替わるのが
// いちばん静かなフィードバックになる。
//
// ログアウトは確認ダイアログ必須。ローカルデータ(庭・記事状態)は消さない:
// supabase.auth.signOut() は認証ストレージだけを消し、庭の高水位(garden-high-water:*)や
// 記事状態(yaranai.articles.state.v1)には触れないため、再ログインで無傷に戻る。
// 言語(yaranai.language.v1)も同様に残る。

import { Modal, Pressable, Text, View, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@yaranai/core';
import { supabase } from '../lib/supabase';
import { useLang, useT } from '../lib/i18n/context';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function AppMenu({ visible, onClose }: Props) {
  const router = useRouter();
  const { lang, setLang } = useLang();
  const t = useT();

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

  const goReading = () => {
    onClose();
    router.push('/(app)/reading');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* 背景タップで閉じる。演出は控えめ(フェードのみ) */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* 理想を入力(§5.3)。ホームヘッダーの表示枠タップと同じ編集画面へ入る */}
          <Pressable style={styles.item} onPress={goIdeal}>
            <Text style={styles.itemText}>{t.menu.ideal}</Text>
          </Pressable>

          <Pressable style={styles.item} onPress={goReading}>
            <Text style={styles.itemText}>{t.menu.reading}</Text>
          </Pressable>

          {/* 言語。両言語の名前をそれぞれの言語で並べる(いま読めない言語の人にも
              自分の言語が見つかるように)。選択中は墨、他方は薄墨 */}
          <View style={[styles.langRow, styles.separated]}>
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
    // 直角だと硬く出るため、角は控えめに丸める(和紙の切り口くらいの緩さ)
    borderRadius: 12,
    // 角丸の外へ項目のタップ範囲がはみ出さないよう内側で切る
    overflow: 'hidden',
    paddingVertical: 6,
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
