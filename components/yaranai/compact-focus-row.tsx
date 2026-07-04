import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { yaranaiColors, yaranaiFonts } from "@/constants/yaranai-theme";
import type { CheckInState, Vow } from "@/lib/yaranai-data";

type Props = {
  vow: Vow;
  onCheckIn: (id: string, kind: NonNullable<CheckInState>) => void;
  onPress?: () => void;
};

export function CompactFocusRow({ vow, onCheckIn, onPress }: Props) {
  const [state, setState] = useState<CheckInState>(vow.todayDone ?? null);

  const handle = (k: NonNullable<CheckInState>) => {
    setState(k);
    onCheckIn(vow.id, k);
  };

  const containerStyle = [
    styles.row,
    state === "kept" && styles.rowKept,
    state === "broke" && styles.rowBroke,
    !state && styles.rowPending,
  ];

  const streakColor =
    state === "broke" ? yaranaiColors.ink3 : yaranaiColors.shu;

  return (
    <Pressable
      style={({ pressed }) => [
        ...containerStyle,
        { opacity: pressed ? 0.85 : 1 },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.streak, { color: streakColor }]}>
        {vow.streak}
        <Text style={styles.streakUnit}>日</Text>
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {vow.label}
      </Text>
      {!state && (
        <View style={styles.btnGroup}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              handle("kept");
            }}
            style={({ pressed }) => [
              styles.btnKept,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            hitSlop={6}
          >
            <Text style={styles.btnKeptText}>○</Text>
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              handle("broke");
            }}
            style={({ pressed }) => [
              styles.btnBroke,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            hitSlop={6}
          >
            <Text style={styles.btnBrokeText}>—</Text>
          </Pressable>
        </View>
      )}
      {state === "kept" && (
        <Ionicons name="checkmark" size={14} color={yaranaiColors.shu} />
      )}
      {state === "broke" && <Text style={styles.brokeNote}>明日また</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  rowPending: {
    backgroundColor: yaranaiColors.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: yaranaiColors.shu,
  },
  rowKept: {
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: yaranaiColors.line,
  },
  rowBroke: {
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: yaranaiColors.lineStrong,
    borderStyle: "dashed",
  },
  streak: {
    minWidth: 32,
    fontFamily: yaranaiFonts.serif,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  streakUnit: {
    fontSize: 10,
    color: yaranaiColors.ink3,
    fontWeight: "400",
    marginLeft: 1,
  },
  label: {
    flex: 1,
    fontFamily: yaranaiFonts.sans,
    fontSize: 13,
    fontWeight: "500",
    color: yaranaiColors.ink,
    lineHeight: 17,
  },
  btnGroup: {
    flexDirection: "row",
    gap: 4,
  },
  btnKept: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: yaranaiColors.shu,
    borderRadius: 8,
  },
  btnKeptText: {
    color: yaranaiColors.paper,
    fontFamily: yaranaiFonts.serif,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  btnBroke: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: yaranaiColors.lineStrong,
    borderRadius: 8,
  },
  btnBrokeText: {
    color: yaranaiColors.ink3,
    fontFamily: yaranaiFonts.hand,
    fontSize: 11,
  },
  brokeNote: {
    fontFamily: yaranaiFonts.hand,
    fontSize: 10,
    color: yaranaiColors.ink4,
  },
});
