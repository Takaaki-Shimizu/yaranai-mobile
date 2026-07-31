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
        // 画面遷移の所作「墨入れ」(components/Sumiire.tsx)。所作の本体はJS側
        // (筆を引く→間→墨入れ)が持ち、Stack の fade は「同色の紙同士の継ぎ目消し」
        // だけを担う。Android の fade は 150ms 固定で、遷移中は新旧両画面の
        // 不透明度が同時に下がりウィンドウ背景が透けるため、app.json の
        // backgroundColor を生成りに固定してある(未指定だとOSテーマの色で暗転が出る)。
        // 庭の「控えめなフェード」(§5.3)もこの既定に含まれる
        animation: 'fade',
      }}
    />
  );
}
