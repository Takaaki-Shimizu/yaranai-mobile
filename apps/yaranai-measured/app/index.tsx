import { useEffect, useState } from 'react';
import { Redirect, type Href } from 'expo-router';
import { useSession } from '@yaranai/core';
import { getPendingEmail, isWorldviewSeen } from '../lib/onboarding';

// 入口の振り分け(オンボーディング §0)。セッションがあれば本編へ
// (オンボーディング途中ならホームが続きへ導く)。無ければ端末の印から
// 世界観導入 → サインアップ → メール確認待ち のどこへ戻すかを決める。
export default function Index() {
  const session = useSession();
  const [target, setTarget] = useState<Href | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (session) {
      setTarget('/(app)');
      return;
    }
    (async () => {
      // 未確認のまま離脱した人は確認待ち([C])から再開する(例外系②)
      const pending = await getPendingEmail();
      const to: Href = pending
        ? '/(auth)/confirm-email'
        : (await isWorldviewSeen())
          ? '/(auth)/sign-in'
          : '/(auth)/worldview';
      if (!cancelled) setTarget(to);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  // 判定中は生成りの地だけ(起動演出の覆いの下なので目には入らない)
  if (!target) return null;
  return <Redirect href={target} />;
}
