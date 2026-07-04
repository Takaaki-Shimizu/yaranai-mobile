import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { yaranaiColors, yaranaiFonts } from "@/constants/yaranai-theme";
import type { Vow } from "@/lib/yaranai-data";
import { MiniHeatmap } from "./mini-heatmap";

type Props = {
  vow: Vow;
  onPress?: () => void;
};

export function VowCard({ vow, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.8 : 1 }]}
      onPress={onPress}
    >
      <MiniHeatmap heat={vow.recent} size={42} />
      <View style={styles.body}>
        <View style={styles.streakRow}>
          <Text style={styles.streak}>{vow.streak}</Text>
          <Text style={styles.streakUnit}>
            日 · {vow.kept}/{vow.total} 達成
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.label}>
          {vow.label}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={14}
        color={yaranaiColors.ink4}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: yaranaiColors.paper,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: yaranaiColors.line,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  streak: {
    fontFamily: yaranaiFonts.serif,
    fontSize: 22,
    fontWeight: "700",
    color: yaranaiColors.shu,
    letterSpacing: -1,
  },
  streakUnit: {
    fontFamily: yaranaiFonts.hand,
    fontSize: 11,
    color: yaranaiColors.ink3,
  },
  label: {
    marginTop: 2,
    fontFamily: yaranaiFonts.sans,
    fontSize: 15,
    fontWeight: "500",
    color: yaranaiColors.ink,
  },
});
