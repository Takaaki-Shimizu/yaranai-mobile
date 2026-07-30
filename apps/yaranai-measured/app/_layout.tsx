import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Slot } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { SessionContext, colors } from '@yaranai/core';
import { LanguageProvider } from '../lib/i18n/context';
import { isDeveloperEmail } from '../lib/developer';
import { isExternalUiReturn } from '../lib/external-ui';
import { LaunchOverlay } from '../components/launch/LaunchOverlay';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // 起動演出「小径」(§6): コールド起動はフルの演出、バックグラウンド復帰は
  // 最終フレームの静止画だけを挟む(still)。id は復帰時の再マウント用。
  const [launch, setLaunch] = useState<{ id: number; visible: boolean; variant: 'full' | 'still' }>({
    id: 0,
    visible: true,
    variant: 'full',
  });

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

  // バックグラウンド復帰では演出は流さず、最終フレームの静止画だけを見せる(§6)。
  // Android は active↔background の二値なので background からの active 復帰だけを見る。
  //
  // ただし共有シートのように「アプリの中から開いた OS の画面」から戻っただけのときは
  // 挟まない ── 共有せずに戻った利用者はアプリを離れとらんけん、静止画が出ると
  // 外から戻ってきたように見えてしまう(lib/external-ui.ts)。
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current === 'background' && next === 'active' && !isExternalUiReturn()) {
        setLaunch((l) => ({ id: l.id + 1, visible: true, variant: 'still' }));
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  const dismissLaunch = useCallback(() => setLaunch((l) => ({ ...l, visible: false })), []);

  // 開発者モード(§6)は演出スキップ。セッション判明はロード後なので、
  // コールドスタート時は冒頭の黒の間に判定が入り、判明した時点で即座に外れる。
  const showLaunch = launch.visible && !isDeveloperEmail(session?.user?.email);

  return (
    // 固定フッター(言い訳カード §3)がジェスチャーバーの下に潜らないよう、
    // 端末の安全域をここから配れるようにしておく
    <SafeAreaProvider>
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      {loading ? (
        <View style={{ flex: 1, backgroundColor: colors.kinari, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.usuzumi} />
        </View>
      ) : (
        <SessionContext.Provider value={session}>
          {/* 表示言語(日本語/英語)。認証画面にも効かせるためセッションと同じ深さに置く */}
          <LanguageProvider>
            <Slot />
          </LanguageProvider>
        </SessionContext.Provider>
      )}
      {/* 起動演出はロードと独立に 2000ms で完結し、ロードが長ければ最終フレームで静止(§5)。
          演出とロードの両方が済んでから、題字を読み取れるだけさらに静止してホームへ。
          ローディングのスピナーはこの覆いの下に隠れるため画面には出ない */}
      {showLaunch && (
        <LaunchOverlay key={launch.id} ready={!loading} variant={launch.variant} onDone={dismissLaunch} />
      )}
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
