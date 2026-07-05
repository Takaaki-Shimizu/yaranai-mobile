import { Text, View } from "react-native";

import { colors, fonts } from "./theme";

type Props = {
  /** 未設定だった環境変数名 */
  missingKeys: string[];
};

// 環境変数が欠けたビルドを起動即クラッシュさせず、
// 生成り地・明朝の静かな画面として表面化させる。
export function MissingConfigScreen({ missingKeys }: Props) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.kinari,
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.serif,
          color: colors.sumi,
          fontSize: 16,
          lineHeight: 28,
          textAlign: "center",
        }}
      >
        設定が見つかりません
      </Text>
      {missingKeys.map((key) => (
        <Text
          key={key}
          style={{
            fontFamily: fonts.serif,
            color: colors.usuzumi,
            fontSize: 13,
            lineHeight: 22,
            marginTop: 12,
            textAlign: "center",
          }}
        >
          {key}
        </Text>
      ))}
    </View>
  );
}
