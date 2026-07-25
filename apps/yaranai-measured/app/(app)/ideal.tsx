// 理想(WHAT)の編集画面。ホームヘッダーの表示枠タップと、ハンバーガーメニューから入る。
//
// 理想は任意入力。空文字での保存は「理想を消す」操作として許可する。
// 20文字上限。改行は禁止(multiline を使わない)。

import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSession, colors, fonts } from '@yaranai/core';
import { IDEAL_MAX_LENGTH, idealLength, validateIdeal } from '../../lib/ideal/validate';
import { loadIdeal, saveIdeal } from '../../lib/ideal/storage';

export default function Ideal() {
  const session = useSession();
  const router = useRouter();
  const userId = session?.user?.id;

  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // 既存値は全文をそのままロードする。21文字以上でも勝手に切り詰めない
  // (短縮を求めるのは、ユーザーが保存しようとした時点)。
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    loadIdeal(userId).then((v) => {
      if (alive) setText(v);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const onChangeText = (next: string) => {
    // 上限はコードポイント単位で数える(絵文字を2文字と数えて弾かないため)。
    // 短くする方向は常に受け付ける(既存の21文字以上のデータを縮められるように)。
    if (idealLength(next) <= IDEAL_MAX_LENGTH || idealLength(next) < idealLength(text)) {
      setText(next);
      setError('');
    }
  };

  const save = async () => {
    if (!userId) return;
    const result = validateIdeal(text);
    if (!result.ok) {
      // エラーは静かなインライン表示にとどめる(アラート・ダイアログは使わない)
      setError(`${IDEAL_MAX_LENGTH}文字以内にしてください。`);
      return;
    }
    setBusy(true);
    const ok = await saveIdeal(userId, result.value);
    setBusy(false);
    if (!ok) {
      setError('保存できませんでした。');
      return;
    }
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>理想を、書く。</Text>

      <View style={styles.form}>
        <Text style={styles.lede}>なぜ、時間を取り戻すのか。</Text>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={onChangeText}
          // RN の maxLength は UTF-16 コード単位。コードポイント20文字は最大40単位になり得るので
          // ここは天井としてだけ置き、実際の20文字上限は onChangeText でコードポイント単位に掛ける。
          // 既存の長い値をロードした直後に切り詰められないよう、現在値の長さも下回らせない。
          maxLength={Math.max(text.length, IDEAL_MAX_LENGTH * 2)}
          returnKeyType="done"
          autoCorrect={false}
          accessibilityLabel="理想"
        />

        <Text style={styles.note}>
          {IDEAL_MAX_LENGTH}文字まで。いつでも書き直せます。
        </Text>

        <Pressable style={styles.primary} onPress={save} disabled={busy}>
          <Text style={styles.primaryText}>保存する</Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>戻る</Text>
        </Pressable>

        {error !== '' && <Text style={styles.error}>{error}</Text>}
      </View>
    </View>
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
  note: {
    fontSize: 12,
    lineHeight: 22,
    color: colors.usuzumi,
    textAlign: 'center',
  },
  primary: {
    marginTop: 28,
    backgroundColor: colors.shu,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    fontFamily: fonts.serif,
    color: colors.kinari,
    fontSize: 16,
    letterSpacing: 6,
  },
  secondary: { paddingVertical: 10, alignItems: 'center' },
  secondaryText: { fontFamily: fonts.serif, fontSize: 13, color: colors.usuzumi, letterSpacing: 3 },
  // 静かなインラインのエラー。朱(colors.shu)では強すぎるので薄墨にとどめる。
  error: { fontSize: 12, color: colors.usuzumi, textAlign: 'center', marginTop: 8 },
});
