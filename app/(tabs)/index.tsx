import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CompactFocusRow } from "@/components/yaranai/compact-focus-row";
import { KaresansuiGarden } from "@/components/yaranai/karesansui-garden";
import { yaranaiColors, yaranaiFonts } from "@/constants/yaranai-theme";
import type { CheckInState } from "@/lib/yaranai-data";
import { yaranaiData } from "@/lib/yaranai-data";
import { supabase } from "@/lib/supabase";

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

// Phase 0..1 from total saved hours.
// 0h → 0 (荒れている), 250h → ~1 (整っている)
const phaseFromSaved = (hours: number) =>
  Math.max(0, Math.min(1, hours / 250));

const captionFor = (phase: number) => {
  if (phase < 0.15) return "— はじめの 庭 —";
  if (phase < 0.45) return "— 砂が、整いはじめた —";
  if (phase < 0.8) return "— 苔が、根づきはじめた —";
  return "— 静けさが、ここに ある —";
};

const dustHint = (phase: number) => {
  if (phase < 0.15) return "庭は まだ 荒れています";
  if (phase < 0.5) return "庭は ゆっくり 整っています";
  return "庭は 静かに 整っています";
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [breaks, setBreaks] = useState(1);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      console.log("session:", data.session);
    });
  }, []);

  const today = new Date();
  const monthDay = `${today.getMonth() + 1}月${today.getDate()}日`;
  const dow = DOW[today.getDay()];

  const focused = useMemo(
    () => yaranaiData.vows.filter((v) => v.focus),
    []
  );
  const quietCount = yaranaiData.vows.length - focused.length;
  const totalSaved = useMemo(
    () => yaranaiData.vows.reduce((s, v) => s + v.savedHours, 0),
    []
  );

  const phase = phaseFromSaved(totalSaved);
  const gardenHeight = Math.max(360, height * 0.6);

  const handleCheckIn = (
    _id: string,
    kind: NonNullable<CheckInState>
  ) => {
    if (kind === "broke") {
      setBreaks((b) => Math.min(b + 1, 8));
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      <View
        style={[
          styles.gardenWrap,
          { height: gardenHeight },
        ]}
      >
        <KaresansuiGarden
          phase={phase}
          breaks={breaks}
          width={width}
          height={gardenHeight}
        />
        <LinearGradient
          colors={["transparent", yaranaiColors.paper]}
          locations={[0, 0.95]}
          style={styles.gardenFade}
          pointerEvents="none"
        />
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + 14 }]}>
        <View>
          <Text style={styles.dateLabel}>
            {monthDay} · {dow}
          </Text>
          <Text style={styles.greeting}>おかえり。</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.bell,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          hitSlop={6}
        >
          <Ionicons
            name="notifications-outline"
            size={18}
            color={yaranaiColors.ink2}
          />
          <View style={styles.bellDot} />
        </Pressable>
      </View>

      <View
        style={[
          styles.captionWrap,
          { top: gardenHeight * 0.66 },
        ]}
        pointerEvents="none"
      >
        <View style={styles.captionPill}>
          <Text style={styles.captionText}>{captionFor(phase)}</Text>
        </View>
      </View>

      <View
        style={[
          styles.panel,
          { top: gardenHeight - 40, paddingBottom: insets.bottom + 14 },
        ]}
      >
        <ScrollView
          contentContainerStyle={styles.panelInner}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.savedRow}>
            <Text style={styles.savedLabel}>守られた時間</Text>
            <Text style={styles.savedValue}>
              {totalSaved.toFixed(0)}
              <Text style={styles.savedUnit}>時間</Text>
            </Text>
            <View style={styles.savedDash} />
            <Text style={styles.savedHint}>{dustHint(phase)}</Text>
          </View>

          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>手元の 三つ</Text>
            <Text style={styles.headerCount}>{focused.length} / 3</Text>
          </View>

          <View style={styles.focusList}>
            {focused.map((v) => (
              <CompactFocusRow
                key={v.id}
                vow={v}
                onCheckIn={handleCheckIn}
              />
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.quietLink,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={styles.quietText}>
              静かに 続けているもの · {quietCount}つ
            </Text>
            <Ionicons
              name="chevron-forward"
              size={11}
              color={yaranaiColors.ink3}
            />
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: yaranaiColors.paper,
  },
  gardenWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  gardenFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingBottom: 4,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    zIndex: 2,
  },
  dateLabel: {
    fontFamily: yaranaiFonts.label,
    fontSize: 13,
    color: yaranaiColors.shu,
    letterSpacing: 1.5,
    fontStyle: "italic",
  },
  greeting: {
    marginTop: 2,
    fontFamily: yaranaiFonts.serif,
    fontWeight: "500",
    fontSize: 15,
    color: yaranaiColors.ink2,
    letterSpacing: 1,
  },
  bell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  bellDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: yaranaiColors.shu,
  },
  captionWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 2,
  },
  captionPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "rgba(248, 243, 230, 0.78)",
    borderRadius: 999,
  },
  captionText: {
    fontFamily: yaranaiFonts.serif,
    fontSize: 11,
    color: yaranaiColors.ink2,
    letterSpacing: 1.5,
    fontWeight: "500",
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: yaranaiColors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: yaranaiColors.line,
    zIndex: 3,
  },
  panelInner: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
  },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: yaranaiColors.line,
  },
  savedLabel: {
    fontFamily: yaranaiFonts.hand,
    fontSize: 10,
    color: yaranaiColors.ink4,
  },
  savedValue: {
    fontFamily: yaranaiFonts.serif,
    fontSize: 16,
    fontWeight: "700",
    color: yaranaiColors.shu,
    letterSpacing: -0.5,
  },
  savedUnit: {
    fontSize: 10,
    color: yaranaiColors.ink3,
    fontWeight: "400",
  },
  savedDash: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: yaranaiColors.line,
    marginHorizontal: 4,
  },
  savedHint: {
    fontFamily: yaranaiFonts.hand,
    fontSize: 10,
    color: yaranaiColors.ink4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
  },
  headerTitle: {
    fontFamily: yaranaiFonts.serif,
    fontSize: 12,
    fontWeight: "600",
    color: yaranaiColors.ink,
    letterSpacing: 3,
  },
  headerCount: {
    fontFamily: yaranaiFonts.label,
    fontSize: 11,
    color: yaranaiColors.ink3,
  },
  focusList: {
    gap: 6,
  },
  quietLink: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: yaranaiColors.lineStrong,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quietText: {
    fontFamily: yaranaiFonts.hand,
    fontSize: 11,
    color: yaranaiColors.ink3,
  },
});
