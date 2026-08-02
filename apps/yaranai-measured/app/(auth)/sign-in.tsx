import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';
import { useSession, colors, fonts } from '@yaranai/core';
import { useT } from '../../lib/i18n/context';
import { Sumiire, useSumiireRouter } from '../../components/Sumiire';
import { GoogleLogo } from '../../components/GoogleLogo';
import { isGoogleAuthAvailable, signInWithGoogle } from '../../lib/google-auth';
import { setPendingEmail } from '../../lib/onboarding';
import {
  CONSENT_ROW_HIDDEN, PRIVACY_URL, TERMS_URL, recordLocalConsent,
} from '../../lib/terms';

type Mode = 'signIn' | 'signUp';

export default function SignIn() {
  const session = useSession();
  const router = useSumiireRouter();
  const t = useT();
  // 世界観導入・確認待ち画面からは mode=signup で入ってくる(オンボーディング §1・§3)
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'signup' ? 'signUp' : 'signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Redirect href="/(app)" />;

  const isSignIn = mode === 'signIn';
  // 同意行はサインアップにのみ出す(§2)。規約URLが未公開の間はフラグで畳める(§10)
  const consentRequired = !isSignIn && !CONSENT_ROW_HIDDEN;
  const consentBlocked = consentRequired && !agreed;

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setMessage(t.auth.signInFailed);
  };

  const signUp = async () => {
    // 同意の日時はサインアップ開始時点で記録し、セッションが張られた起動時に
    // Supabaseへも送る(lib/terms.ts。オフラインでも失わない)
    if (!CONSENT_ROW_HIDDEN) await recordLocalConsent();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: Linking.createURL('confirm-email') },
    });
    if (error) {
      setMessage(t.auth.signUpFailed);
      return;
    }
    // Supabase側で「Confirm email」がONのときは session が張られず確認メール待ちに
    // なる。専用画面([C])へ移り、未確認のまま再起動してもそこから再開する(§3)
    if (!data.session) {
      await setPendingEmail(email.trim());
      router.replace('/(auth)/confirm-email');
    }
  };

  const submit = async () => {
    if (consentBlocked) return;
    if (!email.trim() || !password) {
      setMessage(t.auth.missingFields);
      return;
    }
    setBusy(true);
    setMessage('');
    if (mode === 'signIn') await signIn();
    else await signUp();
    setBusy(false);
  };

  // Google認証(§2)。サインアップ経由では同意チェック済みでないと押せない。
  // 成功すれば onAuthStateChange がセッションを張り、上の Redirect が本編へ運ぶ
  const googleAuth = async () => {
    if (consentBlocked || busy) return;
    setBusy(true);
    setMessage('');
    if (!isSignIn && !CONSENT_ROW_HIDDEN) await recordLocalConsent();
    const result = await signInWithGoogle();
    if (result.status === 'failed') setMessage(t.auth.googleFailed);
    setBusy(false);
  };

  const toggleMode = () => {
    setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'));
    setMessage('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* 墨入れ(画面遷移の所作)。キーボード回避は器に残し、内容だけが据わる */}
      <Sumiire>
      <Text style={styles.wordmark}>Yaranai</Text>

      <View style={styles.form}>
        <Text style={styles.modeLabel}>{isSignIn ? t.auth.welcomeBack : t.auth.startNew}</Text>

        <TextInput
          style={styles.input}
          placeholder={t.auth.emailPlaceholder}
          placeholderTextColor={colors.usuzumi}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder={t.auth.passwordPlaceholder}
          placeholderTextColor={colors.usuzumi}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {/* 同意行(§2)。未チェックの間、はじめる・Googleではじめる は非活性 */}
        {consentRequired && (
          <Pressable
            style={styles.consentRow}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            accessibilityLabel={t.auth.consentA11y}
            onPress={() => setAgreed((a) => !a)}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
              {agreed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.consentText}>
              {t.auth.agreePrefix}
              <Text style={styles.consentLink} onPress={() => Linking.openURL(TERMS_URL)}>
                {t.auth.termsLink}
              </Text>
              {t.auth.agreeAnd}
              <Text style={styles.consentLink} onPress={() => Linking.openURL(PRIVACY_URL)}>
                {t.auth.privacyLink}
              </Text>
              {t.auth.agreeSuffix}
            </Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.primary, consentBlocked && styles.disabled]}
          onPress={submit}
          disabled={busy || consentBlocked}
        >
          <Text style={styles.primaryText}>{isSignIn ? t.auth.enter : t.auth.begin}</Text>
        </Pressable>

        {/* Google認証(§2)。ネイティブモジュールとwebClientIdが揃うビルドでだけ現れる。
            ロゴはブランドガイドライン準拠(白地・4色のG)。文言はサインアップが
            「Googleではじめる」 */}
        {isGoogleAuthAvailable && (
          <Pressable
            style={[styles.google, consentBlocked && styles.disabled]}
            onPress={googleAuth}
            disabled={busy || consentBlocked}
          >
            <GoogleLogo size={18} />
            <Text style={styles.googleText}>
              {isSignIn ? t.auth.googleEnter : t.auth.googleBegin}
            </Text>
          </Pressable>
        )}

        {message !== '' && <Text style={styles.message}>{message}</Text>}

        <Pressable style={styles.secondary} onPress={toggleMode} disabled={busy}>
          <Text style={styles.secondaryText}>
            {isSignIn ? t.auth.createAccount : t.auth.haveAccount}
          </Text>
        </Pressable>

        {/* Link ではなく「筆を引く」ルーターを通す(墨入れの所作を挟むため) */}
        {isSignIn && (
          <Pressable style={styles.link} onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={styles.linkText}>{t.auth.forgotPassword}</Text>
          </Pressable>
        )}
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
  consentRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: colors.usuzumi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.sumi, borderColor: colors.sumi },
  checkmark: { color: colors.kinari, fontSize: 12, lineHeight: 14 },
  consentText: { fontSize: 12, lineHeight: 20, color: colors.sumi, letterSpacing: 0.5 },
  consentLink: { textDecorationLine: 'underline' },
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
  // 非活性は沈めるだけ。急かす色・警告は出さない
  disabled: { opacity: 0.4 },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(43,39,35,0.22)', // sumi #2B2723 の22%
    paddingVertical: 13,
  },
  googleText: { fontSize: 14, color: colors.sumi, letterSpacing: 1 },
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
  message: {
    color: colors.shu,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
