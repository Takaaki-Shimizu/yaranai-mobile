import { StyleSheet, Text, View } from "react-native";
import { yaranaiColors, yaranaiFonts } from "@/constants/yaranai-theme";

type Props = {
  children: string;
  size?: number;
};

export function Seal({ children, size = 26 }: Props) {
  return (
    <View
      style={[
        styles.seal,
        {
          width: size,
          height: size,
          borderRadius: 3,
        },
      ]}
    >
      <Text style={[styles.text, { fontSize: Math.floor(size * 0.55) }]}>
        {children}
      </Text>
      <View
        pointerEvents="none"
        style={[
          styles.innerLine,
          { borderRadius: 2, top: 2, right: 2, bottom: 2, left: 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  seal: {
    backgroundColor: yaranaiColors.shu,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 0,
    elevation: 1,
  },
  text: {
    color: yaranaiColors.paper,
    fontFamily: yaranaiFonts.serif,
    fontWeight: "700",
  },
  innerLine: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
});
