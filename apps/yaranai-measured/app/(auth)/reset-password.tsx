import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase, parseAuthTokensFromUrl } from '../../lib/supabase';
import { colors, fonts } from '@yaranai/core';

export default function ResetPassword() {
  const router = useRouter();
  const url = Linking.useURL();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // ネイティブ: ディープリンクの token からリカバリーセッションを張る。
  // Web: detectSessionInUrl が自動でやってくれるので、ここは実質no-op。
  useEffect(() => {
    if (!url) return;
    const { accessToken, refreshToken, type } = parseAuthTokensFromUrl(url);
    if (type === 'recovery' && accessToken && refreshToken) {
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }
  }, [url]);

  const updatePassword = async () => {
    if (password.length < 6) {
      setMessage('パスワードは6文字以上にしてください。');
      return;
    }
    if (password !== confirm) {
      setMessage('パスワードが一致しません。');
      return;
    }
    setBusy(true);
    setMessage('');
    setNotice('');

    // リカバリーリンク経由でセッションが張られている必要がある
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setMessage('リンクの有効期限が切れているようです。もう一度メールを送ってください。');
      setBusy(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage('変更できませんでした。もう一度お試しください。');
      setBusy(false);
      return;
    }
    setDone(true);
    setNotice('パスワードを変更しました。');
    setBusy(false);
  };

  if (done) {
    return (
      <View style={styles.container}>
        <Text style={styles.wordmark}>Yaranai</Text>
        <View style={styles.form}>
          <Text style={styles.notice}>パスワードを変更しました。</Text>
          <Pressable style={styles.primary} onPress={() => router.replace('/(app)')}>
            <Text style={styles.primaryText}>入 る</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.wordmark}>Yaranai</Text>

      <View style={styles.form}>
        <Text style={styles.title}>あたらしいパスワード</Text>

        <TextInput
          style={styles.input}
          placeholder="あたらしいパスワード"
          placeholderTextColor={colors.usuzumi}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="もう一度入力"
          placeholderTextColor={colors.usuzumi}
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
        />

        <Pressable style={styles.primary} onPress={updatePassword} disabled={busy}>
          <Text style={styles.primaryText}>変更する</Text>
        </Pressable>

        {notice !== '' && <Text style={styles.notice}>{notice}</Text>}
        {message !== '' && <Text style={styles.message}>{message}</Text>}

        <Link href="/(auth)/sign-in" asChild>
          <Pressable style={styles.link}>
            <Text style={styles.linkText}>ログインにもどる</Text>
          </Pressable>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.kinari,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  wordmark: {
    fontFamily: fonts.serif,
    fontSize: 22,
    letterSpacing: 8,
    color: colors.sumi,
    textAlign: 'center',
    marginBottom: 48,
  },
  form: { gap: 16 },
  title: {
    fontFamily: fonts.serif,
    fontSize: 16,
    letterSpacing: 4,
    color: colors.sumi,
    textAlign: 'center',
    marginBottom: 8,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: colors.usuzumi,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.sumi,
    textAlign: 'center',
  },
  primary: {
    marginTop: 24,
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
  link: { paddingVertical: 10, alignItems: 'center' },
  linkText: {
    fontFamily: fonts.serif,
    color: colors.usuzumi,
    fontSize: 14,
    letterSpacing: 4,
  },
  notice: {
    color: colors.koke,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 20,
  },
  message: {
    color: colors.shu,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
