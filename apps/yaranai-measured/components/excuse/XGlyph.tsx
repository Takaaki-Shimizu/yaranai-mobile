// Xのロゴ。ポスト導線のアイコンにだけ使う。
//
// 形は X 公式のロゴ(いわゆる𝕏)のパス。色は他のボタン文字と同じ墨で置き、
// ブランドカラーの黒地は敷かない ── この画面の語彙は文字と余白だけなので、
// アイコンも「一文字」として扱う。

import Svg, { Path } from 'react-native-svg';

export function XGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117Z"
      />
    </Svg>
  );
}
