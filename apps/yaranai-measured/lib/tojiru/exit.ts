// 演出の区間 E。アプリをバックグラウンドへ移す(指示書 §3)。
//
// プロセスを殺す手段(finishAndRemoveTask 等)は使わない。次回起動時に
// 通常の起動演出「小径」から始まればよく、そのために状態を消す必要はない。
// React Native では moveTaskToBack 相当が BackHandler.exitApp()。
// iOS には対応する作法がないので何も起きない(ホームボタンが正)。

import { BackHandler } from 'react-native';

export function exitToBackground(): void {
  BackHandler.exitApp();
}
