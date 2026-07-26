// ホームヘッダー直下に常設する理想(WHAT)の表示枠。
//
// 理想は「なぜ時間を取り戻すのか」の答えなので、庭の直上に常にある。開発者モードの有無に
// 関わらずこの枠を使う(旧「開発者モード · 実測は取得しません」バッジがあった位置)。
//
// 高さは定数で固定する。未入力でも同じ高さを確保し、理想の有無で庭の描画開始位置が
// 上下に動かないようにするため。未入力時は何も出さない(催促文言は出さない: 非強制の原則)。
// 庭の要素ではないので、入庭時の差分演出(フェードイン)には通さない。

import { useCallback, useState } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSession, colors, fonts } from '@yaranai/core';
import { loadIdeal } from '../lib/ideal/storage';
import { useT } from '../lib/i18n/context';

// 旧バッジの実測高さ(paddingVertical 4×2 + 1行ぶんの行高 15 + 罫線 1×2 ≒ 23)をそのまま採る。
export const IDEAL_HEADER_HEIGHT = 23;

export function IdealHeader() {
  const session = useSession();
  const router = useRouter();
  const t = useT();
  const userId = session?.user?.id;
  const [ideal, setIdeal] = useState('');

  // 編集画面から戻ったときに反映されるよう、focus のたびに読み直す。
  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        setIdeal('');
        return;
      }
      let alive = true;
      loadIdeal(userId).then((v) => {
        if (alive) setIdeal(v);
      });
      return () => {
        alive = false;
      };
    }, [userId]),
  );

  return (
    <Pressable
      // 未入力でもタップ領域は生きている(視覚的なヒントは出さない)。
      style={({ pressed }) => [styles.frame, pressed && styles.pressed]}
      onPress={() => router.push('/(app)/ideal')}
      accessibilityRole="button"
      accessibilityLabel={t.ideal.editA11y}
    >
      {ideal !== '' && (
        // 1行固定。既存の21文字以上のデータは末尾省略で耐える(保険)。
        <Text style={styles.text} numberOfLines={1} ellipsizeMode="tail">
          {ideal}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: IDEAL_HEADER_HEIGHT,
    marginBottom: 12,
    paddingVertical: 4,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 押下のフィードバックは最小限(リップルは使わない)
  pressed: { opacity: 0.7 },
  text: {
    fontFamily: fonts.serif,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 2,
    color: colors.usuzumi,
    textAlign: 'center',
  },
});
