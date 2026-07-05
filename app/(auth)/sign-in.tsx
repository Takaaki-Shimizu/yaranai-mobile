import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Redirect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { colors, fonts } from '../../lib/theme';

export default function SignIn() {
  const session = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Redirect href="/(app)" />;

  const signIn = async () => {
    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setMessage('入れませんでした。メールとパスワードを確かめてください。');
    setBusy(false);
  };

  const signUp = async () => {
    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) setMessage('はじめられませんでした。少し時間をおいてもう一度。');
    // Supabase側で「Confirm email」をOFFにしておけば、そのままセッションが張られる
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.wordmark}>Yaranai</Text>

      <View style={styles.form}>
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

        <Pressable style={styles.primary} onPress={signIn} disabled={busy}>
          <Text style={styles.primaryText}>入る</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={signUp} disabled={busy}>
          <Text style={styles.secondaryText}>はじめる</Text>
        </Pressable>

        {message !== '' && <Text style={styles.message}>{message}</Text>}
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
    marginBottom: 64,
  },
  form: { gap: 16 },
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
  message: {
    color: colors.usuzumi,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});
