// バックグラウンド復帰の「世代番号」。復帰するたびに 1 ずつ増える。
//
// Android では画面を離れとる間に描画面(GPU サーフェス)が捨てられ、復帰時に
// 作り直される。Skia の Canvas は作り直された面へ描き直すはずやけど、復帰の
// タイミングによっては描き直しが起こらず、庭だけが空のまま残ることがある。
// 手動リロードで直っとったのは、リロードが焼き直しと再描画を強制するため。
//
// この番号を Canvas の key とベイクの依存に入れることで、復帰のたびに
// 「作り直した面へ、焼き直した絵を」確実に描く。復帰直後の 800ms は起動演出の
// 静止画(LaunchOverlay variant="still")が画面を覆っとるけん、焼き直しの間は
// 利用者からは見えん。

import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export function useForegroundGeneration(): number {
  const [generation, setGeneration] = useState(0);
  const state = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      // Android は active↔background の二値。iOS の inactive(通知センター等)では
      // 描画面は捨てられんけん、background からの復帰だけを数える
      // (_layout.tsx の起動演出の判定と同じ条件)。
      if (state.current === 'background' && next === 'active') {
        setGeneration((g) => g + 1);
      }
      state.current = next;
    });
    return () => sub.remove();
  }, []);

  return generation;
}
