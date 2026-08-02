// タブ画面遷移「木漏れ日フェード」の調整用パラメータ(スペック §3)。
// 実機レビュー後の調整はこのファイルの数値の差し替えだけで完結させること。
//
// 対象はフッター3タブ(庭 / 読みもの / 言い訳カード)間の遷移のみ。
// スタック遷移(宣言・誓い詳細など)・close ritual・起動スプラッシュには使わない。

import { Easing as RNEasing, type EasingFunction } from 'react-native';
import { Easing as ReEasing, type EasingFunction as ReEasingFunction } from 'react-native-reanimated';
import { GARDEN_COLORS } from '../garden/tokens';

/** クロスフェード時間(bottom-tabs の transitionSpec に渡す) */
export const TAB_FADE_DURATION_MS = 280;

/** クロスフェードのイージング。RN Animated 用(bottom-tabs は Reanimated ではない) */
export const TAB_FADE_EASING: EasingFunction = RNEasing.inOut(RNEasing.sin);

/** 木漏れ日レイヤーのピーク不透明度。「注視すれば分かる」程度に留める(§4-2)。
 *  開発時の目視確認は一時的に 0.3 へ上げる(§5)── 確認後は必ず 0.06 に戻すこと */
export const KOMOREBI_PEAK_OPACITY = 0.06;

/** 立ち上がり(光が差す)時間。ピークは切替発火から この値 ms 後 */
export const KOMOREBI_RISE_MS = 110;

/** 減衰(光が引く)時間。立ち上がりと合わせて 320ms で消え切る */
export const KOMOREBI_FALL_MS = 210;

/** レイヤー色。庭の木漏れ日(光だまり)と同一トークン。新しい色を発明しない */
export const KOMOREBI_COLOR: string = GARDEN_COLORS.lightPool;

/** 立ち上がりのイージング(すっと差す)。木漏れ日レイヤーは Reanimated 駆動 */
export const KOMOREBI_RISE_EASING: ReEasingFunction = ReEasing.out(ReEasing.sin);

/** 減衰のイージング(ゆっくり引く) */
export const KOMOREBI_FALL_EASING: ReEasingFunction = ReEasing.inOut(ReEasing.sin);
