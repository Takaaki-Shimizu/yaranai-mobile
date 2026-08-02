// メール確認待ち(オンボーディング §3)。サインアップ後、session が張られん間の専用画面。
// 未確認のままアプリを再起動しても、pending_email の印でこの画面から再開する(例外系②)。
// 確認リンクはディープリンクでここへ戻り、parseAuthTokensFromUrl でセッションを張る。

import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase, parseAuthTokensFromUrl } from '../../lib/supabase';
import { useSession, colors, fonts } from '@yaranai/core';
import { useT } from '../../lib/i18n/context';
import { Sumiire, useSumiireRouter } from '../../components/Sumiire';
import { clearPendingEmail, getPendingEmail } from '../../lib/onboarding';

// 再送の連打防止(§3)。急かさんための間でもある
const RESEND_COOLDOWN_SEC = 60;

export default function ConfirmEmail() {
  const session = useSession();
  const router = useSumiireRouter();
  const t = useT();
  const url = Linking.useURL();
  const [email, setEmail] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [notice, setNotice] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPendingEmail().then((e) => setEmail(e ?? ''));
  }, []);

  // 確認リンク(ディープリンク)からセッションを張る。Supabaseの確認リンクは
  // type=signup のトークンを運んでくる(メール変更の確認は type=email_change)
  useEffect(() => {
    if (!url) return;
    const { accessToken, refreshToken, type } = parseAuthTokensFromUrl(url);
    if ((type === 'signup' || type === 'email' || type === 'email_change') && accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    }
  }, [url]);

  // セッションが張れたら確認済み。待ちの印を畳んで本編へ(ホームが [D] 開示へ導く)
  useEffect(() => {
    if (session) clearPendingEmail();
  }, [session]);

  // 再送クールダウンの残り秒
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown > 0]);

  if (session) return <Redirect href="/(app)" />;

  const resend = async () => {
    if (cooldown > 0 || busy || !email) return;
    setBusy(true);
    setNotice('');
    setMessage('');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: Linking.createURL('confirm-email') },
    });
    setBusy(false);
    if (error) {
      setMessage(t.confirmEmail.resendFailed);
      return;
    }
    setNotice(t.confirmEmail.resent);
    setCooldown(RESEND_COOLDOWN_SEC);
  };

  // メールアドレスを間違えた方: 待ちの印を畳んで、サインアップからやり直す
  const backToSignUp = async () => {
    await clearPendingEmail();
    router.replace({ pathname: '/(auth)/sign-in', params: { mode: 'signup' } });
  };

  return (
    <Sumiire style={styles.container}>
      <Text style={styles.wordmark}>Yaranai</Text>

      <View style={styles.form}>
        <Text style={styles.title}>{t.confirmEmail.title}</Text>
        {email !== '' && <Text style={styles.email}>{email}</Text>}
        <Text style={styles.body}>{t.confirmEmail.body}</Text>

        <Pressable
          style={[styles.resend, (cooldown > 0 || busy) && styles.resendDisabled]}
          onPress={resend}
          disabled={cooldown > 0 || busy}
        >
          <Text style={styles.resendText}>{t.confirmEmail.resend}</Text>
        </Pressable>

        {notice !== '' && <Text style={styles.notice}>{notice}</Text>}
        {cooldown > 0 && <Text style={styles.wait}>{t.confirmEmail.resendWait(cooldown)}</Text>}
        {message !== '' && <Text style={styles.message}>{message}</Text>}

        <Pressable style={styles.link} onPress={backToSignUp}>
          <Text style={styles.linkText}>{t.confirmEmail.wrongEmail}</Text>
        </Pressable>
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
  email: {
    fontSize: 14,
    letterSpacing: 1,
    color: colors.sumi,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.serif,
    fontSize: 14,
    lineHeight: 28,
    letterSpacing: 1,
    color: colors.sumi,
    textAlign: 'center',
  },
  resend: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(43,39,35,0.22)', // sumi #2B2723 の22%(ホームの木札と同じ)
    paddingVertical: 14,
    alignItems: 'center',
  },
  resendDisabled: { opacity: 0.4 },
  resendText: { fontFamily: fonts.serif, fontSize: 14, color: colors.sumi, letterSpacing: 4 },
  wait: {
    color: colors.usuzumi,
    fontSize: 12,
    textAlign: 'center',
  },
  link: { paddingVertical: 10, alignItems: 'center' },
  linkText: { color: colors.usuzumi, fontSize: 13, letterSpacing: 2 },
  notice: {
    color: colors.koke,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  message: {
    color: colors.shu,
    fontSize: 12,
    textAlign: 'center',
  },
});
