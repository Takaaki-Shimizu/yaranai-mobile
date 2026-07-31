// 固定フッター(指示書 §3)。3タブ: 庭(ホーム) / 読みもの / 言い訳カード。
//
// 作法:
//   - アイコンのみ。文字ラベルは置かない ── 名称は遷移先の画面ヘッダーが担う。
//   - 汎用マーク(家・本・カード)は使わず、庭の語彙から採った細い線画にする:
//     庭=飛石(三つ石) / 読みもの=巻物 / 言い訳カード=灯り(灯籠)。
//     灯りはカードの絵の中心モチーフと視覚的に地続き。
//   - バッジ・赤丸・未読数は置かない(小さなFOMO製造機になるため)。
//   - 生成り地に細い罫線1本。選択中は墨、他は薄墨。それ以外の選択表現は使わない。
//
// 庭モード(絵巻の横パン)にはこのフッターを置かない = 進入すると沈む。
// ホーム最下部の「とじる」はスクロール末尾の通常要素のままで、ここには入れない。

import type { ReactElement } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';
import { colors } from '@yaranai/core';
import { useT } from '../lib/i18n/context';
import { FooterWashi } from './washi/Washi';
import { useSumiireRouter } from './Sumiire';

export type FooterTab = 'garden' | 'reading' | 'excuse';

/** 罫線から下端までの高さ。各画面はこのぶんだけ内容の下に余白を足す */
export const FOOTER_HEIGHT = 56;

const ICON = 24;
const STROKE = 1.1;

/** 庭 = 飛石(三つ石)。ホームの庭窓に敷いてある石と同じ並び */
function StonesIcon({ color }: { color: string }) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Ellipse cx={6.6} cy={16.4} rx={3.6} ry={2.3} stroke={color} strokeWidth={STROKE} fill="none" />
      <Ellipse cx={13} cy={12} rx={3.1} ry={2} stroke={color} strokeWidth={STROKE} fill="none" />
      <Ellipse cx={18.2} cy={7.6} rx={2.5} ry={1.7} stroke={color} strokeWidth={STROKE} fill="none" />
    </Svg>
  );
}

/** 読みもの = 巻物。両端の軸と、開いた紙の上下 */
function ScrollIcon({ color }: { color: string }) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Ellipse cx={5} cy={12} rx={1.9} ry={3.8} stroke={color} strokeWidth={STROKE} fill="none" />
      <Ellipse cx={19} cy={12} rx={1.9} ry={3.8} stroke={color} strokeWidth={STROKE} fill="none" />
      <Line x1={5} y1={8.2} x2={19} y2={8.2} stroke={color} strokeWidth={STROKE} />
      <Line x1={5} y1={15.8} x2={19} y2={15.8} stroke={color} strokeWidth={STROKE} />
    </Svg>
  );
}

/** 言い訳カード = 灯り(灯籠)。笠・火袋・火・竿・基礎 */
function LanternIcon({ color }: { color: string }) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      <Path
        d="M4.6 9 L7.6 5.4 L16.4 5.4 L19.4 9 Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        fill="none"
      />
      <Rect x={8.4} y={9.6} width={7.2} height={5.6} stroke={color} strokeWidth={STROKE} fill="none" />
      <Circle cx={12} cy={12.4} r={1.1} fill={color} />
      <Line x1={12} y1={15.2} x2={12} y2={19.2} stroke={color} strokeWidth={STROKE} />
      <Line x1={8.6} y1={19.4} x2={15.4} y2={19.4} stroke={color} strokeWidth={STROKE} />
    </Svg>
  );
}

// typedRoutes(app.json)が有効なので、遷移先は router が受け取れる型で持つ
type Href = Parameters<ReturnType<typeof useRouter>['navigate']>[0];

type Item = { tab: FooterTab; href: Href; label: string; icon: (p: { color: string }) => ReactElement };

export function AppFooter({ active }: { active: FooterTab }) {
  // タブ移動も「筆を引いてから移る」。帯そのものは3画面で共通なので動かない
  const router = useSumiireRouter();
  const t = useT();
  const insets = useSafeAreaInsets();
  const barHeight = FOOTER_HEIGHT + insets.bottom;

  const items: Item[] = [
    { tab: 'garden', href: '/(app)', label: t.footer.garden, icon: StonesIcon },
    { tab: 'reading', href: '/(app)/reading', label: t.footer.reading, icon: ScrollIcon },
    { tab: 'excuse', href: '/(app)/excuse', label: t.footer.excuse, icon: LanternIcon },
  ];

  return (
    <View style={[styles.bar, { height: barHeight, paddingBottom: insets.bottom }]}>
      {/* 和紙意匠(§5)。フッターは3画面で同じ帯なので、意匠もここで常に敷く
          ── 画面ごとに有無が変わると、タブを移った瞬間に地が入れ替わって見える。
          帯に内包して境界でクリップし、アイコンより背面に置く。
          帯の実高(下インセット込み)へ縦をストレッチして端末差に追従する */}
      <FooterWashi height={barHeight} />
      {items.map(({ tab, href, label, icon: Icon }) => (
        <Pressable
          key={tab}
          style={styles.slot}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ selected: tab === active }}
          // 文字ラベルを持たないので、読み上げ名はここでだけ与える(§3)
          accessibilityLabel={label}
          // navigate はスタックに同じ画面があれば積まずに戻る。
          // タブを行き来しても履歴が伸びず、端末の戻るでホームへ帰れる
          onPress={() => {
            if (tab !== active) router.navigate(href);
          }}
        >
          <Icon color={tab === active ? colors.sumi : colors.usuzumi} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.kinari,
    borderTopWidth: 1,
    borderTopColor: colors.suna,
  },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
});
