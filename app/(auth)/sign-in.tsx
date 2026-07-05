import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Link, Redirect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { colors, fonts } from '../../lib/theme';

type Mode = 'signIn' | 'signUp';

export default function SignIn() {
  const session = useSession();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Redirect href="/(app)" />;

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setMessage('入れませんでした。メールとパスワードを確かめてください。');
  };

  const signUp = async () => {
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) {
      setMessage('はじめられませんでした。少し時間をおいてもう一度。');
      return;
    }
    // Supabase側で「Confirm email」がONのときは、session が張られず
    // 確認メール待ちになる。そのときは案内を出す。
    if (!data.session) {
      setNotice('確認メールを送りました。メールのリンクを開いてからお入りください。');
    }
  };

  const submit = async () => {
    if (!email.trim() || !password) {
      setMessage('メールとパスワードを入れてください。');
      return;
    }
    setBusy(true);
    setMessage('');
    setNotice('');
    if (mode === 'signIn') await signIn();
    else await signUp();
    setBusy(false);
  };

  const toggleMode = () => {
    setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'));
    setMessage('');
    setNotice('');
  };

  const isSignIn = mode === 'signIn';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.wordmark}>Yaranai</Text>

      <View style={styles.form}>
        <Text style={styles.modeLabel}>{isSignIn ? 'おかえりなさい' : 'あたらしくはじめる'}</Text>

        <TextInput
          style={styles.input}
          placeholder="メールアドレス"
          placeholderTextColor={colors.usuzumi}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="パスワード"
          placeholderTextColor={colors.usuzumi}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Pressable style={styles.primary} onPress={submit} disabled={busy}>
          <Text style={styles.primaryText}>{isSignIn ? '入る' : 'はじめる'}</Text>
        </Pressable>

        {notice !== '' && <Text style={styles.notice}>{notice}</Text>}
        {message !== '' && <Text style={styles.message}>{message}</Text>}

        <Pressable style={styles.secondary} onPress={toggleMode} disabled={busy}>
          <Text style={styles.secondaryText}>
            {isSignIn ? 'アカウントをつくる' : 'すでにアカウントをお持ちの方'}
          </Text>
        </Pressable>

        {isSignIn && (
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable style={styles.link}>
              <Text style={styles.linkText}>パスワードをお忘れの方</Text>
            </Pressable>
          </Link>
        )}
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
  modeLabel: {
    fontFamily: fonts.serif,
    fontSize: 15,
    letterSpacing: 4,
    color: colors.usuzumi,
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
  secondary: { paddingVertical: 10, alignItems: 'center' },
  secondaryText: {
    fontFamily: fonts.serif,
    color: colors.usuzumi,
    fontSize: 14,
    letterSpacing: 4,
  },
  link: { paddingVertical: 4, alignItems: 'center' },
  linkText: {
    color: colors.usuzumi,
    fontSize: 13,
    letterSpacing: 2,
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
