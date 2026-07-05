import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { supabase, missingEnvVars } from '../lib/supabase'; // 既存の LargeSecureStore 版をそのまま使う
import { SessionContext, colors, MissingConfigScreen } from '@yaranai/core';

export default function RootLayout() {
  // 環境変数が欠けたビルドはクラッシュではなく設定エラー画面で止める
  if (missingEnvVars.length > 0) {
    return <MissingConfigScreen missingKeys={missingEnvVars} />;
  }
  return <SessionGate />;
}

function SessionGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.kinari, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.usuzumi} />
      </View>
    );
  }

  return (
    <SessionContext.Provider value={session}>
      <Slot />
    </SessionContext.Provider>
  );
}
