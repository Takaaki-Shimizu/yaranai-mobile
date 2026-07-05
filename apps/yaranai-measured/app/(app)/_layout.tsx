import { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { useSession, colors } from '@yaranai/core';
import { syncAll } from '../../lib/usage-sync';

export default function AppLayout() {
  const session = useSession();

  // 起動時の同期: OSの日次バケット→端末内DB、誓い対象の確定日→Supabase
  useEffect(() => {
    if (session) syncAll(session.user.id);
  }, [session]);

  if (!session) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.kinari },
      }}
    />
  );
}
