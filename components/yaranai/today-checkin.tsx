import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { yaranaiColors, yaranaiFonts } from "@/constants/yaranai-theme";

type Kind = "struggle" | "easy" | "broke";

type Props = {
  vow: { id: string; label: string; streak: number };
  onCheckIn: (id: string, kind: Kind) => void;
};

export function TodayCheckIn({ vow, onCheckIn }: Props) {
  const [done, setDone] = useState(false);
  const [animState, setAnimState] = useState<Kind | null>(null);

  const handle = (kind: Kind) => {
    setAnimState(kind);
    setTimeout(() => {
      setDone(true);
      onCheckIn(vow.id, kind);
    }, 400);
  };

  if (done) {
    return (
      <View style={styles.doneCard}>
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark" size={20} color={yaranaiColors.paper} />
        </View>
        <View>
          <Text style={styles.doneTitle}>きょうの記録、ありがとう。</Text>
          <Text style={styles.doneSub}>
            {vow.label} —{" "}
            <Text style={styles.doneStreak}>{vow.streak + 1}</Text>日目
          </Text>
        </View>
      </View>
    );
  }

  const buttonOpacity = (kind: Kind) =>
    animState && animState !== kind ? 0.4 : 1;

  return (
    <View style={styles.card}>
      <View style={styles.cornerBadge}>
        <Text style={styles.cornerText}>きょう</Text>
      </View>
      <Text style={styles.eyebrow}>Today&apos;s vow</Text>
      <Text style={styles.title}>
        「{vow.label}」を、{"\n"}やらなかった？
      </Text>
      <View style={styles.btnRow}>
        <Pressable
          style={({ pressed }) => [
            styles.btnGhost,
            { opacity: pressed ? 0.6 : buttonOpacity("struggle") },
          ]}
          onPress={() => handle("struggle")}
        >
          <Text style={styles.btnGhostText}>こらえた</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.btnPrimary,
            { opacity: pressed ? 0.85 : buttonOpacity("easy") },
          ]}
          onPress={() => handle("easy")}
        >
          <Text style={styles.btnPrimaryText}>余裕で やらなかった</Text>
        </Pressable>
      </View>
      <Pressable
        style={styles.btnQuiet}
        onPress={() => handle("broke")}
        hitSlop={6}
      >
        <Text style={styles.btnQuietText}>やってしまった ・・</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    marginTop: 14,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    backgroundColor: yaranaiColors.paper,
    borderWidth: 1,
    borderColor: yaranaiColors.shu,
    borderRadius: 16,
    shadowColor: yaranaiColors.shu,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cornerBadge: {
    position: "absolute",
    top: -1,
    right: -1,
    backgroundColor: yaranaiColors.shu,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 8,
  },
  cornerText: {
    color: yaranaiColors.paper,
    fontFamily: yaranaiFonts.hand,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
  },
  eyebrow: {
    fontFamily: yaranaiFonts.label,
    fontSize: 14,
    color: yaranaiColors.shu,
    letterSpacing: 1,
    fontStyle: "italic",
  },
  title: {
    marginTop: 4,
    fontFamily: yaranaiFonts.serif,
    fontSize: 19,
    fontWeight: "700",
    lineHeight: 27,
    color: yaranaiColors.ink,
  },
  btnRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  btnGhost: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: yaranaiColors.paper2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: yaranaiColors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhostText: {
    color: yaranaiColors.ink2,
    fontFamily: yaranaiFonts.hand,
    fontSize: 13,
    fontWeight: "600",
  },
  btnPrimary: {
    flex: 1.4,
    height: 46,
    borderRadius: 12,
    backgroundColor: yaranaiColors.shu,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: {
    color: yaranaiColors.paper,
    fontFamily: yaranaiFonts.hand,
    fontSize: 13,
    fontWeight: "600",
  },
  btnQuiet: {
    marginTop: 6,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  btnQuietText: {
    fontFamily: yaranaiFonts.hand,
    fontSize: 12,
    color: yaranaiColors.ink4,
  },
  doneCard: {
    marginHorizontal: 18,
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: yaranaiColors.paper2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: yaranaiColors.line,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  doneIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: yaranaiColors.shu,
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: {
    fontFamily: yaranaiFonts.serif,
    fontWeight: "600",
    fontSize: 15,
    color: yaranaiColors.ink,
  },
  doneSub: {
    marginTop: 2,
    fontFamily: yaranaiFonts.hand,
    fontSize: 12,
    color: yaranaiColors.ink3,
  },
  doneStreak: {
    color: yaranaiColors.shu,
  },
});
