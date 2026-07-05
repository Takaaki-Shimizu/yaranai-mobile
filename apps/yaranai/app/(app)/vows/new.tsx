import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useSession, colors, fonts } from '@yaranai/core';

export default function NewVow() {
  const session = useSession();
  const router = useRouter();
  const [label, setLabel] = useState('');
  const [minutes, setMinutes] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const declare = async () => {
    if (!session) return;
    const trimmed = label.trim();
    const m = parseInt(minutes, 10);
    if (!trimmed) {
      setMessage('やめることを、ひとつ書いてください。');
      return;
    }
    if (isNaN(m) || m < 0 || m > 1440) {
      setMessage('1日に渡していた時間を、分で書いてください。');
      return;
    }

    setBusy(true);
    setMessage('');
    const { error } = await supabase.from('yaranai_items').insert({
      user_id: session.user.id,
      label: trimmed,
      minutes_per_day: m,
      is_focused: true,
    });
    setBusy(false);

    if (error) {
      // 注力枠3つ超過はDBトリガーが止める
      if (error.message.includes('手元におけるのは最大3つまで')) {
        setMessage('手元におけるのは、3つまでです。');
      } else {
        setMessage('宣言できませんでした。もう一度お試しください。');
      }
      return;
    }
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>やらない、を宣言する。</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="やめること(例: ショート動画を観る)"
          placeholderTextColor={colors.usuzumi}
          value={label}
          onChangeText={setLabel}
        />
        <TextInput
          style={styles.input}
          placeholder="1日に渡していた時間(分)"
          placeholderTextColor={colors.usuzumi}
          keyboardType="number-pad"
          value={minutes}
          onChangeText={setMinutes}
        />

        <Pressable style={styles.primary} onPress={declare} disabled={busy}>
          <Text style={styles.primaryText}>宣言する</Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>戻る</Text>
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
  title: {
    fontFamily: fonts.serif,
    fontSize: 20,
    letterSpacing: 4,
    color: colors.sumi,
    textAlign: 'center',
    marginBottom: 56,
  },
  form: { gap: 20 },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: colors.usuzumi,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.sumi,
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
  message: { color: colors.shu, fontSize: 12, textAlign: 'center', marginTop: 8 },
});
