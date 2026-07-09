import { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { useSession, colors } from '@yaranai/core';
import { syncAll } from '../../lib/usage-sync';
import { useIsDeveloper } from '../../lib/developer';

export default function AppLayout() {
  const session = useSession();
  const isDeveloper = useIsDeveloper();

  // 起動時の同期: OSの日次バケット→端末内DB、誓い対象の確定日→Supabase。
  // 開発者モード(§5)は実測パイプラインに触れないため同期をスキップする。
  useEffect(() => {
    if (session && !isDeveloper) syncAll(session.user.id);
  }, [session, isDeveloper]);

  if (!session) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.kinari },
      }}
    >
      {/* 庭モードへは控えめなフェードで入る(§5.3)。派手な演出はしない */}
      <Stack.Screen name="garden" options={{ animation: 'fade' }} />
    </Stack>
  );
}
