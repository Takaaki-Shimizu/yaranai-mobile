import { Pressable, StyleSheet, Text, View } from "react-native";

import { yaranaiColors, yaranaiFonts } from "@/constants/yaranai-theme";

type Props = {
  goalLabel: string;
  daysLeft: number;
  linkedCount: number;
  onPress?: () => void;
};

export function CompassCard({
  goalLabel,
  daysLeft,
  linkedCount,
  onPress,
}: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
      onPress={onPress}
    >
      <View style={styles.glow} pointerEvents="none" />
      <View>
        <Text style={styles.eyebrow}>I want to ——</Text>
        <Text style={styles.label}>{goalLabel}</Text>
        <Text style={styles.meta}>
          あと <Text style={styles.metaStrong}>{daysLeft}</Text>日 · そのために{" "}
          <Text style={styles.metaStrong}>{linkedCount}つ</Text>やめている
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: yaranaiColors.washi,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: yaranaiColors.line,
    borderRadius: 16,
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    top: -20,
    right: -20,
    width: 90,
    height: 90,
    backgroundColor: yaranaiColors.shuTint,
    borderRadius: 45,
    opacity: 0.6,
  },
  eyebrow: {
    fontFamily: yaranaiFonts.label,
    fontSize: 15,
    color: yaranaiColors.shu,
    letterSpacing: 1,
    fontStyle: "italic",
  },
  label: {
    marginTop: 4,
    fontFamily: yaranaiFonts.serif,
    fontWeight: "700",
    fontSize: 22,
    lineHeight: 30,
    color: yaranaiColors.ink,
  },
  meta: {
    marginTop: 10,
    fontFamily: yaranaiFonts.hand,
    fontSize: 12,
    color: yaranaiColors.ink3,
  },
  metaStrong: {
    color: yaranaiColors.ink,
    fontFamily: yaranaiFonts.serif,
    fontWeight: "700",
  },
});
