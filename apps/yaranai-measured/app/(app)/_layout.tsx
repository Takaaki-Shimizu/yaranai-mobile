import { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { useSession, colors } from '@yaranai/core';
import { syncAll } from '../../lib/usage-sync';
import { evaluateCrashedDay } from '../../lib/articles/evaluate';
import { useIsDeveloper } from '../../lib/developer';

export default function AppLayout() {
  const session = useSession();
  const isDeveloper = useIsDeveloper();

  // 起動時の同期: OSの日次バケット→端末内DB、誓い対象の確定日→Supabase。
  // 開発者モード(§5)は実測パイプラインに触れないため同期をスキップする。
  // 同期完了の直後に読みものの発火判定を1回だけ回す(§4.1)。
  useEffect(() => {
    if (session && !isDeveloper) {
      syncAll(session.user.id).then(() => evaluateCrashedDay());
    }
  }, [session, isDeveloper]);

  if (!session) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.kinari },
        // 画面遷移の所作「墨入れ」(components/Sumiire.tsx)。全画面が同じ生成りの
        // 地を敷いているので、フェードにすると紙は動かず墨(内容)だけが入れ替わって
        // 見える。庭の「控えめなフェード」(§5.3)もこの既定に含まれる。
        // 各画面は Sumiire で内容の浮き上がりをこの上に重ねる。
        // animationDuration は対応環境(iOS)でのみ効き、Android はOSのフェードに従う
        animation: 'fade',
        animationDuration: 300,
      }}
    />
  );
}
