import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Slot } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { SessionContext, colors } from '@yaranai/core';

export default function RootLayout() {
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
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <SessionContext.Provider value={session}>
        <Slot />
      </SessionContext.Provider>
    </GestureHandlerRootView>
  );
}
