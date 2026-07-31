// 認証まわりの Stack。ヘッダーは出さず、地は本編と同じ生成りで通す。
// 遷移も (app)/_layout と同じ「墨入れ」の作法(所作の本体はJS側。
// fade は同色の紙同士の継ぎ目消しだけを担う)。

import { Stack } from 'expo-router';
import { colors } from '@yaranai/core';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.kinari },
        animation: 'fade',
      }}
    />
  );
}
