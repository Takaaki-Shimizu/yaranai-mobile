// 理想(WHAT)の編集画面。ホームヘッダーの表示枠タップと、ハンバーガーメニューから入る。
// オンボーディングでは、宣言の直後にもここを一度だけ通る(onboarding=1)。
//
// 理想は任意入力。空文字での保存は「理想を消す」操作として許可する。
// 20文字上限。改行は禁止(multiline を使わない)。

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSession, colors, fonts } from '@yaranai/core';
import { Sumiire, useSumiireRouter } from '../../components/Sumiire';
import { IDEAL_MAX_LENGTH, idealLength, validateIdeal } from '../../lib/ideal/validate';
import { loadCachedIdeal, loadIdeal, saveIdeal } from '../../lib/ideal/storage';
import { useT } from '../../lib/i18n/context';

export default function Ideal() {
  const session = useSession();
  const router = useSumiireRouter();
  const t = useT();
  const userId = session?.user?.id;
  // オンボーディングの通り道(宣言 → ここ → 庭)。戻る先は宣言完了画面ではなく庭:
  // 宣言は済んどるけん、来た道を戻らせず、書いても飛ばしても同じ庭へ抜ける
  const params = useLocalSearchParams<{ onboarding?: string }>();
  const onboarding = params.onboarding === '1';
  const leave = () => {
    if (onboarding) router.replace('/(app)/(tabs)');
    else router.back();
  };

  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // 書き始めたあとにサーバーの応答が届いても、入力を奪わんための印。
  // 正本の取得は非同期やけん、遅れて返った値で上書きすると打っとる言葉が消える
  const edited = useRef(false);

  // 既存値は全文をそのままロードする。21文字以上でも勝手に切り詰めない
  // (短縮を求めるのは、ユーザーが保存しようとした時点)。
  //
  // 正本はサーバー(lib/ideal/storage.ts)。先に端末の写しを入れて入力欄を埋め、
  // 取れた正本で差し替える ── 圏外では写しのまま編集でき、保存の可否だけが変わる。
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const cached = await loadCachedIdeal(userId);
      if (alive && !edited.current) setText(cached);
      const current = await loadIdeal(userId);
      if (alive && !edited.current) setText(current);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const onChangeText = (next: string) => {
    edited.current = true;
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
      setError(t.ideal.tooLong(IDEAL_MAX_LENGTH));
      return;
    }
    setBusy(true);
    const ok = await saveIdeal(userId, result.value);
    setBusy(false);
    if (!ok) {
      setError(t.ideal.saveFailed);
      return;
    }
    leave();
  };

  return (
    <Sumiire style={styles.container}>
      <Text style={styles.title}>{t.ideal.title}</Text>

      <View style={styles.form}>
        <Text style={styles.lede}>{t.ideal.lede}</Text>

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
          accessibilityLabel={t.ideal.inputA11y}
        />

        <Text style={styles.note}>{t.ideal.note(IDEAL_MAX_LENGTH)}</Text>

        <Pressable style={styles.primary} onPress={save} disabled={busy}>
          <Text style={styles.primaryText}>{t.ideal.save}</Text>
        </Pressable>

        {/* オンボーディングでは戻る先がない(宣言は済んどる)。同じ位置に
            「とばす」を置いて、書かずに庭へ抜ける道を必ず残す */}
        <Pressable style={styles.secondary} onPress={leave}>
          <Text style={styles.secondaryText}>{onboarding ? t.ideal.skip : t.ideal.back}</Text>
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
