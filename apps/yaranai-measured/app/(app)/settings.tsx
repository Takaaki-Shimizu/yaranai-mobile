// 設定画面(設定+お問い合わせ スペック §3)。
//
// ここは「便利機能の置き場」ではなく「制度の棚」── お問い合わせ・きまりごと・
// アカウントという、日常的に触らないものだけを置く。読みものはフッターのタブが
// 持つけんここには置かない(ハンバーガーメニューが読みものを持たないのと同じ理屈)。
//
// colors.shu は使わない(§7)。朱は Day84 の到達と宣言時の主要ボタンにのみ
// 割り当てられた色で、設定画面の項目に使うと意味が薄まる。
// 「アカウントを削除する」も薄墨のまま最下部に置く ── 警告色で煽らず、
// 制度の棚の中でも最も重い操作であることを位置で示す。

import { useCallback, useEffect, useState } from 'react';
import {
  Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { colors, fonts, useSession } from '@yaranai/core';
import { supabase } from '../../lib/supabase';
import { buildMailtoUrl, CONTACT_EMAIL } from '../../lib/contact';
import { loadGrowth } from '../../components/garden/load';
import { isMissingGraduatedOn } from '../../lib/vows';
import { PRIVACY_URL, TERMS_URL } from '../../lib/terms';
import { useT } from '../../lib/i18n/context';
import { Sumiire, useSumiireRouter } from '../../components/Sumiire';
import { HeaderWashi } from '../../components/washi/Washi';

// 診断情報の「宣言数」= 挑戦中の誓いの数(discontinued も graduated も除く)。
// マイグレーション 003 未適用の Supabase では graduated_on 列が無く 42703 で
// 落ちるけん、そのときだけ列なしで引き直して全行を挑戦中として数える。
async function fetchActiveVowCount(): Promise<number> {
  const full = await supabase
    .from('measured_vows')
    .select('graduated_on')
    .is('discontinued_on', null);
  if (!isMissingGraduatedOn(full.error)) {
    if (full.error) throw full.error;
    return (full.data ?? []).filter((v) => !v.graduated_on).length;
  }
  const legacy = await supabase
    .from('measured_vows')
    .select('id')
    .is('discontinued_on', null);
  if (legacy.error) throw legacy.error;
  return (legacy.data ?? []).length;
}

export default function Settings() {
  const router = useSumiireRouter();
  const session = useSession();
  const t = useT();

  // 記録日数・宣言数は画面に入った時点で先に取りに行く(タップ時に待たせない)。
  // 取れんかった回は 0 に丸めず null のまま送り、本文には「取得できず」と出す ──
  // 「記録日数 0日・宣言数 0」と書いてしまうと、記録の欠落や復元の相談で届いた本文が
  // 「まだ何も宣言しとらん人」に見え、調査が逆方向へ行く。
  // 診断情報は本文で見えて編集できるけん、欠けとってもユーザーが気づける
  const [diag, setDiag] = useState<{ recordedDays: number | null; vowCount: number | null }>({
    recordedDays: null,
    vowCount: null,
  });
  const [mailFallback, setMailFallback] = useState(false);
  // 記録が入る仕組みの開示(§3-1b)。既定はたたんだ状態
  const [recordGapOpen, setRecordGapOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!session) return;
    let active = true;
    Promise.all([
      loadGrowth(session.user.id).catch(() => null),
      fetchActiveVowCount().catch(() => null),
    ]).then(([growth, vowCount]) => {
      if (!active) return;
      setDiag({
        recordedDays: growth?.status === 'ok' ? growth.growth.recordedDays : null,
        vowCount,
      });
    });
    return () => {
      active = false;
    };
  }, [session]);

  // 開発ビルド(Expo Go 等)ではネイティブ側の値が null になるけん app.json の値へ倒す
  const version =
    Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '?';
  const build = Application.nativeBuildVersion ?? '?';

  const openContact = useCallback(async () => {
    const body = t.settings.mailBody({
      version,
      build,
      androidVersion: String(Platform.Version),
      deviceModel: Device.modelName ?? '?',
      recordedDays: diag.recordedDays,
      vowCount: diag.vowCount,
      userId: session?.user.id ?? '?',
    });
    const url = buildMailtoUrl(CONTACT_EMAIL, t.settings.mailSubject, body);
    // メールアプリ未設定の端末が実在する(§4.4。特に業務端末・軽量ROM)。
    // openURL は成功しても例外を投げる端末があるため、catch でも同じ受け皿へ倒す
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        setMailFallback(true);
        return;
      }
      await Linking.openURL(url);
    } catch {
      setMailFallback(true);
    }
  }, [t, version, build, diag, session]);

  const copyAddress = useCallback(async () => {
    await Clipboard.setStringAsync(CONTACT_EMAIL);
    setCopied(true);
  }, []);

  const closeFallback = useCallback(() => {
    setMailFallback(false);
    setCopied(false);
  }, []);

  return (
    <Sumiire style={styles.container}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* ヘッダー帯。和紙意匠は帯に内包し上端にアンカーする(和紙意匠 §2)。
            庭とUIが視覚語彙を共有する方針のため、設定画面にも同じ紙を敷く(§7) */}
        <View style={styles.headerBlock}>
          <HeaderWashi />
          <Text style={styles.title}>{t.settings.title}</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionHead}>{t.settings.sectionAbout}</Text>
          <Pressable style={styles.item} onPress={openContact}>
            <Text style={styles.itemText}>{t.settings.contact}</Text>
          </Pressable>

          {/* 記録が入る仕組み(記録欠落の開示 §3-1b)。診断情報を送る窓口の隣に、
              たたんだ状態で置く。開いた人にだけ本文が出る ── 制度の棚に置く説明であって、
              読ませにいくものではない。矢印や警告色は付けない */}
          <Pressable style={styles.item} onPress={() => setRecordGapOpen((v) => !v)}>
            <Text style={styles.itemQuietText}>{t.settings.recordGapItem}</Text>
          </Pressable>
          {recordGapOpen && (
            <View style={styles.gapBody}>
              {t.settings.recordGapBody.map((p) => (
                <Text key={p} style={styles.gapParagraph}>{p}</Text>
              ))}
            </View>
          )}

          <Text style={[styles.sectionHead, styles.sectionGap]}>
            {t.settings.sectionRules}
          </Text>
          {/* 文面の修正にストア審査を挟まんよう、アプリ内に埋め込まず外部ブラウザで
              開く(§6)。LP側に置いておけば即時に直せる */}
          <Pressable
            style={styles.item}
            onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
          >
            <Text style={styles.itemText}>{t.settings.privacy}</Text>
          </Pressable>
          <Pressable
            style={styles.item}
            onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}
          >
            <Text style={styles.itemText}>{t.settings.terms}</Text>
          </Pressable>

          <Text style={[styles.sectionHead, styles.sectionGap]}>
            {t.settings.sectionAccount}
          </Text>
          {/* 確認は別画面(§5.2)。モーダルの誤タップで不可逆な処理へ滑らせない */}
          <Pressable
            style={styles.item}
            onPress={() => router.push('/(app)/delete-account')}
          >
            <Text style={styles.itemQuietText}>{t.settings.deleteAccount}</Text>
          </Pressable>

          <Text style={styles.version}>{t.settings.versionLine(version, build)}</Text>
        </View>

        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>{t.settings.back}</Text>
        </Pressable>
      </ScrollView>

      {/* メールアプリが開けんかったときの受け皿(§4.4)。
          アドレスは選択もコピーもできる形で出す */}
      <Modal
        visible={mailFallback}
        transparent
        animationType="fade"
        onRequestClose={closeFallback}
      >
        <View style={styles.fbBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeFallback} />
          <View style={styles.fbCard}>
            <Text style={styles.fbBody}>{t.settings.fallbackBody}</Text>
            <View style={styles.fbRow}>
              <Text style={styles.fbAddress} selectable>
                {CONTACT_EMAIL}
              </Text>
              <Pressable onPress={copyAddress} hitSlop={8}>
                <Text style={styles.fbCopy}>
                  {copied ? t.settings.copied : t.settings.copy}
                </Text>
              </Pressable>
            </View>
            <Pressable style={styles.fbClose} onPress={closeFallback} hitSlop={8}>
              <Text style={styles.fbCloseText}>{t.settings.fallbackClose}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Sumiire>
  );
}

// 面の紙(AppMenu と同じ)。地と同色だと背景に沈むため、半段だけ明るい紙を使う
const WASHI = '#F6F1E6';
// 項目間の区切り(§7)。薄墨の 1px を薄く敷く ── 砂色より半歩だけ立つ程度
const HAIRLINE = 'rgba(140, 133, 119, 0.35)';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.kinari },
  content: { paddingBottom: 80 },
  headerBlock: { overflow: 'hidden' },
  title: {
    fontFamily: fonts.serif,
    fontSize: 20,
    letterSpacing: 4,
    color: colors.sumi,
    textAlign: 'center',
    paddingTop: 64,
    marginBottom: 40,
  },
  body: { paddingHorizontal: 32 },
  sectionHead: {
    fontFamily: fonts.serif,
    fontSize: 12,
    letterSpacing: 4,
    color: colors.usuzumi,
    marginBottom: 4,
  },
  sectionGap: { marginTop: 44 },
  item: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  itemText: { fontFamily: fonts.serif, fontSize: 15, color: colors.sumi, letterSpacing: 2 },
  // アカウントを削除する(§3.2)。警告色で煽らず、薄墨で最下部に据える
  itemQuietText: {
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.usuzumi,
    letterSpacing: 2,
  },
  // 記録が入る仕組み(§3-1b)を開いたときの本文。枠線も背景色も敷かず、段落の間だけで区切る
  gapBody: { paddingVertical: 16, gap: 16 },
  gapParagraph: { fontSize: 13, lineHeight: 24, color: colors.usuzumi },
  version: { marginTop: 18, fontSize: 13, color: colors.usuzumi, letterSpacing: 1 },
  back: { marginTop: 64, paddingVertical: 10, alignItems: 'center' },
  backText: { fontFamily: fonts.serif, fontSize: 13, color: colors.usuzumi, letterSpacing: 3 },

  fbBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 39, 35, 0.28)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  fbCard: {
    backgroundColor: WASHI,
    borderWidth: 1,
    borderColor: colors.suna,
    borderRadius: 12,
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  fbBody: { fontSize: 13, lineHeight: 24, color: colors.sumi, letterSpacing: 1 },
  fbRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  fbAddress: { fontFamily: fonts.serif, fontSize: 15, color: colors.sumi, letterSpacing: 1 },
  fbCopy: { fontSize: 13, color: colors.usuzumi, letterSpacing: 2 },
  fbClose: { marginTop: 28, alignItems: 'center', paddingVertical: 6 },
  fbCloseText: { fontFamily: fonts.serif, fontSize: 13, color: colors.usuzumi, letterSpacing: 3 },
});
