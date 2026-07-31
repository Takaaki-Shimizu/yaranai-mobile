// 宣言をつくる儀式(指示書 §4.2)。作成も差し替えも、必ずこの2画面を通る。
//
//   1. 入力    … 「やらないこと」だけの自由入力。プレースホルダーは例文をランダム表示(§7)。
//                「はやらない。」はアプリが添え、行組みもアプリが決める(§4.2-1)。
//                入力中はその添えたあとの一文を下に映して、何を宣言するのかを見せる。
//   2. 確認    … 明朝・中央寄せの一拍。「これを、やらないと宣言しますか。」
//   3. 完成演出… カード画面へ ?reveal=1 で渡す(演出はカード画面が持つ)。
//
// カード作成は宣言行為であり、発話した瞬間に真になる。実測の裏付けは要らない ──
// この画面はDay数も庭も一切参照しない(§1 / §2-6)。

import { useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
} from 'react-native';
import { useSession, colors, fonts } from '@yaranai/core';

import { pickPlaceholder } from '../../../lib/excuse/placeholders';
import { markRevealPending } from '../../../lib/excuse/reveal-flag';
import { declareExcuse } from '../../../lib/excuse/storage';
import {
  EXCUSE_MAX_WIDTH, excuseLines, excuseWidth, normalizeExcuse, validateExcuse,
} from '../../../lib/excuse/validate';
import { useLang, useT } from '../../../lib/i18n/context';
import { Sumiire, useSumiireRouter } from '../../../components/Sumiire';

export default function ExcuseNew() {
  const session = useSession();
  const router = useSumiireRouter();
  const t = useT();
  const { lang } = useLang();
  const userId = session?.user?.id;

  const [text, setText] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // 例文は画面を開くたびに変わる。言語を切り替えても同じ例文の対訳が出るよう、
  // 引くのは一度きりにして、言語だけを掛け直す
  const seed = useRef(Math.random()).current;
  const placeholder = pickPlaceholder(lang, seed);

  const onChangeText = (next: string) => {
    // 上限は全角換算。型(「はやらない。」)まで書き添えた入力は、型を落としたぶんで測る
    // ── 例文をそのまま貼っても弾かれない。短くする方向は常に受け付ける
    if (
      excuseWidth(normalizeExcuse(next)) <= EXCUSE_MAX_WIDTH
      || excuseWidth(next) < excuseWidth(text)
    ) {
      setText(next);
      setError('');
    }
  };

  const toConfirm = () => {
    const result = validateExcuse(text);
    if (!result.ok) {
      // エラーは静かなインライン表示にとどめる(アラート・ダイアログは使わない)
      setError(
        result.reason === 'empty'
          ? t.excuse.errorEmpty
          : t.excuse.errorTooLong(EXCUSE_MAX_WIDTH),
      );
      return;
    }
    setError('');
    setConfirming(true);
  };

  const declare = async () => {
    const result = validateExcuse(text);
    if (!userId || !result.ok || busy) return;
    setBusy(true);
    const saved = await declareExcuse(userId, result.value);
    setBusy(false);
    if (!saved.ok) {
      // 画面に出すのは静かな一文だけ。原因(スキーマ未投入など)はログへ回す
      console.warn('[excuse] declare failed:', saved.reason);
      setConfirming(false);
      setError(t.excuse.saveFailed);
      return;
    }
    // 差し替えのときも同じ道を通る。旧宣言はサーバー側で superseded 化されている。
    // 演出の合図だけ置いて、この画面は畳む
    markRevealPending();
    router.back();
  };

  // ---- 確認(一拍 §4.2-2) -----------------------------------------------
  // どちらの分岐もルートは同型の Sumiire(墨入れ)なので、入力⇔確認の行き来では
  // 再マウントされず、入場はこの画面へ来た一度きりしか流れない
  if (confirming) {
    const lines = excuseLines(text, lang);
    return (
      <Sumiire style={styles.container}>
        <View style={styles.confirmBody}>
          {/* 上限いっぱいの行(全角21字)は画面幅を超える。折り返さず、字ごと縮めて1行に収める */}
          {lines.map((line, i) => (
            <Text key={i} style={styles.confirmLine} numberOfLines={1} adjustsFontSizeToFit>
              {line}
            </Text>
          ))}
          <Text style={styles.question}>{t.excuse.confirmQuestion}</Text>
          <Pressable style={styles.primary} onPress={declare} disabled={busy}>
            <Text style={styles.primaryText}>{t.excuse.declare}</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => setConfirming(false)}>
            <Text style={styles.secondaryText}>{t.excuse.back}</Text>
          </Pressable>
        </View>
      </Sumiire>
    );
  }

  // ---- 入力 --------------------------------------------------------------
  // 添えたあとの一文。書いている最中から、宣言の形をそのまま見せておく
  const preview = excuseLines(text, lang);

  return (
    <Sumiire style={styles.container}>
      <Text style={styles.title}>{t.excuse.title}</Text>

      <View style={styles.form}>
        <Text style={styles.lede}>{t.excuse.inputLede}</Text>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.usuzumi}
          // RN の maxLength は UTF-16 コード単位。実際の上限は onChangeText で
          // 全角換算に掛けるので、ここは天井としてだけ置く
          maxLength={Math.max(text.length, EXCUSE_MAX_WIDTH * 4)}
          returnKeyType="done"
          autoCorrect={false}
          accessibilityLabel={t.excuse.inputA11y}
        />

        {preview.length > 0 && (
          <View style={styles.preview}>
            {preview.map((line, i) => (
              <Text key={i} style={styles.previewLine} numberOfLines={1} adjustsFontSizeToFit>
                {line}
              </Text>
            ))}
          </View>
        )}

        <Text style={styles.note}>{t.excuse.inputNote(EXCUSE_MAX_WIDTH)}</Text>

        <Pressable style={styles.primary} onPress={toConfirm}>
          <Text style={styles.primaryText}>{t.excuse.next}</Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>{t.excuse.back}</Text>
        </Pressable>

        {error !== '' && <Text style={styles.error}>{error}</Text>}
      </View>
    </Sumiire>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.kinari,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 20,
    letterSpacing: 4,
    color: colors.sumi,
    textAlign: 'center',
    marginBottom: 40,
  },
  form: { gap: 20 },
  lede: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 30,
    letterSpacing: 1,
    color: colors.sumi,
    textAlign: 'center',
  },
  input: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: colors.usuzumi,
    fontFamily: fonts.serif,
    fontSize: 17,
    letterSpacing: 2,
    color: colors.sumi,
    textAlign: 'center',
  },
  note: { fontSize: 12, lineHeight: 22, color: colors.usuzumi, textAlign: 'center' },

  // 添えたあとの一文の下見。入力そのものより弱く置き、主役を奪わない
  preview: { alignItems: 'center' },
  previewLine: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 28,
    letterSpacing: 2,
    color: colors.usuzumi,
    textAlign: 'center',
  },

  // 宣言の一拍(§4.2-2)。世界観の語りと同じ体裁: 明朝・中央寄せ・余白多め。
  // 朱は使わない(§2-5)ため、ここのボタンも面で塗らず、文字だけで置く
  confirmBody: { alignItems: 'center', gap: 16 },
  confirmLine: {
    fontFamily: fonts.serif,
    fontSize: 20,
    lineHeight: 40,
    letterSpacing: 3,
    color: colors.sumi,
    textAlign: 'center',
  },
  question: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 32,
    letterSpacing: 2,
    color: colors.usuzumi,
    textAlign: 'center',
    marginTop: 40,
  },
  primary: { marginTop: 28, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  primaryText: { fontFamily: fonts.serif, fontSize: 16, color: colors.sumi, letterSpacing: 6 },
  secondary: { paddingVertical: 10, alignItems: 'center' },
  secondaryText: { fontFamily: fonts.serif, fontSize: 13, color: colors.usuzumi, letterSpacing: 3 },
  // 静かなインラインのエラー。朱では強すぎるので薄墨にとどめる
  error: { fontSize: 12, color: colors.usuzumi, textAlign: 'center', marginTop: 8 },
});
