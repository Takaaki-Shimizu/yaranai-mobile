import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Link } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';
import { colors, fonts } from '../../lib/theme';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const sendReset = async () => {
    if (!email.trim()) {
      setMessage('メールアドレスを入れてください。');
      return;
    }
    setBusy(true);
    setMessage('');
    setNotice('');
    // Web: http://localhost:8081/reset-password
    // ネイティブ: yaranaiapp://reset-password
    const redirectTo = Linking.createURL('/reset-password');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    if (error) {
      setMessage('送れませんでした。少し時間をおいてもう一度。');
    } else {
      setNotice('パスワード再設定のメールを送りました。メールのリンクを開いてください。');
    }
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.wordmark}>Yaranai</Text>

      <View style={styles.form}>
        <Text style={styles.title}>パスワードの再設定</Text>
        <Text style={styles.description}>
          ご登録のメールアドレスに、再設定用のリンクをお送りします。
        </Text>

        <TextInput
          style={styles.input}
          placeholder="メールアドレス"
          placeholderTextColor={colors.usuzumi}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Pressable style={styles.primary} onPress={sendReset} disabled={busy}>
          <Text style={styles.primaryText}>送 る</Text>
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
  },
  description: {
    color: colors.usuzumi,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
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
