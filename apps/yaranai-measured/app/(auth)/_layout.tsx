// 認証まわりの Stack。ヘッダーは出さず、地は本編と同じ生成りで通す。
// 遷移も (app)/_layout と同じ「墨入れ」の作法: 紙は動かさず、フェードで
// 墨(内容)だけが入れ替わる。各画面は Sumiire で内容の浮き上がりを重ねる。

import { Stack } from 'expo-router';
import { colors } from '@yaranai/core';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.kinari },
        animation: 'fade',
        animationDuration: 300,
      }}
    />
  );
}
