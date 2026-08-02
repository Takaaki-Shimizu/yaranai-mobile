import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Linking from 'expo-linking';
import { supabase, parseAuthTokensFromUrl } from '../../lib/supabase';
import { colors, fonts } from '@yaranai/core';
import { useT } from '../../lib/i18n/context';
import { Sumiire, useSumiireRouter } from '../../components/Sumiire';

export default function ResetPassword() {
  const router = useSumiireRouter();
  const t = useT();
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
      setMessage(t.auth.passwordTooShort);
      return;
    }
    if (password !== confirm) {
      setMessage(t.auth.passwordMismatch);
      return;
    }
    setBusy(true);
    setMessage('');
    setNotice('');

    // リカバリーリンク経由でセッションが張られている必要がある
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setMessage(t.auth.linkExpired);
      setBusy(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(t.auth.updateFailed);
      setBusy(false);
      return;
    }
    setDone(true);
    setNotice(t.auth.passwordChanged);
    setBusy(false);
  };

  if (done) {
    return (
      <View style={styles.container}>
        <Sumiire>
        <Text style={styles.wordmark}>Yaranai</Text>
        <View style={styles.form}>
          <Text style={styles.notice}>{t.auth.passwordChanged}</Text>
          <Pressable style={styles.primary} onPress={() => router.replace('/(app)/(tabs)')}>
            <Text style={styles.primaryText}>{t.auth.enter}</Text>
          </Pressable>
        </View>
        </Sumiire>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* 墨入れ(画面遷移の所作)。キーボード回避は器に残し、内容だけが据わる */}
      <Sumiire>
      <Text style={styles.wordmark}>Yaranai</Text>

      <View style={styles.form}>
        <Text style={styles.title}>{t.auth.newPasswordTitle}</Text>

        <TextInput
          style={styles.input}
          placeholder={t.auth.newPasswordPlaceholder}
          placeholderTextColor={colors.usuzumi}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder={t.auth.confirmPlaceholder}
          placeholderTextColor={colors.usuzumi}
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
        />

        <Pressable style={styles.primary} onPress={updatePassword} disabled={busy}>
          <Text style={styles.primaryText}>{t.auth.update}</Text>
        </Pressable>

        {notice !== '' && <Text style={styles.notice}>{notice}</Text>}
        {message !== '' && <Text style={styles.message}>{message}</Text>}

        {/* Link ではなく「筆を引く」ルーターを通す。navigate なので履歴は伸びない */}
        <Pressable style={styles.link} onPress={() => router.navigate('/(auth)/sign-in')}>
          <Text style={styles.linkText}>{t.auth.backToSignIn}</Text>
        </Pressable>
      </View>
      </Sumiire>
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
