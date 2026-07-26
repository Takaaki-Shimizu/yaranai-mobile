import { useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, AppState } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, fonts } from '@yaranai/core';
import {
  hasUsageAccess,
  isUsageStatsAvailable,
  openUsageAccessSettings,
} from '../../modules/usage-stats';
import { useT } from '../../lib/i18n/context';

export default function Permission() {
  const router = useRouter();
  const t = useT();

  const checkAndLeave = useCallback(() => {
    if (isUsageStatsAvailable && hasUsageAccess()) {
      router.replace('/(app)');
    }
  }, [router]);

  // 設定画面から戻ってきたときに再確認する
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkAndLeave();
    });
    return () => sub.remove();
  }, [checkAndLeave]);

  useFocusEffect(
    useCallback(() => {
      checkAndLeave();
    }, [checkAndLeave])
  );

  if (!isUsageStatsAvailable) {
    return (
      <View style={styles.container}>
        <Text style={styles.wordmark}>Yaranai</Text>
        <Text style={styles.body}>{t.permission.androidOnly}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.wordmark}>Yaranai</Text>

      <View style={styles.form}>
        <Text style={styles.body}>{t.permission.body}</Text>
        <Text style={styles.note}>{t.permission.note}</Text>

        <Pressable style={styles.primary} onPress={openUsageAccessSettings}>
          <Text style={styles.primaryText}>{t.permission.openSettings}</Text>
        </Pressable>
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
  wordmark: {
    fontFamily: fonts.serif,
    fontSize: 22,
    letterSpacing: 8,
    color: colors.sumi,
    textAlign: 'center',
    marginBottom: 48,
  },
  form: { gap: 20 },
  body: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 32,
    letterSpacing: 1,
    color: colors.sumi,
    textAlign: 'center',
  },
  note: {
    color: colors.usuzumi,
    fontSize: 13,
    lineHeight: 22,
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
});
