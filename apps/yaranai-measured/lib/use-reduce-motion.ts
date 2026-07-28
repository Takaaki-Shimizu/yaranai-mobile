// 端末の「アニメーションを無効化」等のアクセシビリティ設定。
// 起動演出は自前で AccessibilityInfo を見て静止画へ落とすが(LaunchOverlay §6)、
// 閉じ際演出はタップの瞬間に判定が要る(待たせずに即座に閉じるため)ので、
// 画面の表示中に先読みしておく。判定前は false(=演出する)。
//
// OS 側の切り替えにも追随する(設定画面から戻ってきた直後でも正しく効く)。

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (alive) setReduce(v); })
      .catch(() => { /* 取れんときは演出する(既定) */ });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return reduce;
}
