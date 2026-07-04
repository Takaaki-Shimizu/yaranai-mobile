import { Ionicons } from "@expo/vector-icons";
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PaperBg } from "@/components/yaranai/paper-bg";
import { YearHeatmap } from "@/components/yaranai/year-heatmap";
import { yaranaiColors, yaranaiFonts } from "@/constants/yaranai-theme";
import { yaranaiData, type Vow } from "@/lib/yaranai-data";

const HEATMAP_LEGEND_COLORS = [
  yaranaiColors.paper3,
  "#dec3b4",
  "#c79277",
  "#b86c54",
  "#a14735",
];

export default function KisekiScreen() {
  const insets = useSafeAreaInsets();
  const skipped = yaranaiData.vows.reduce((sum, v) => sum + v.kept, 0);
  const annualSkipped = 238; // matches the design's headline number

  return (
    <PaperBg>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <View style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={20} color={yaranaiColors.ink2} />
        </View>
        <Text style={styles.title}>きせき</Text>
        <View style={styles.iconBtn}>
          <Ionicons
            name="ellipsis-horizontal"
            size={18}
            color={yaranaiColors.ink2}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroBlock}>
          <Text style={styles.heroTitle}>
            この一年で、{"\n"}
            <Text style={styles.heroAccent}>{annualSkipped}日</Text> やめた。
          </Text>
          <Text style={styles.heroSub}>
            塗られた日が、あなたが選ばなかった日。
          </Text>
        </View>

        <View style={styles.heatmapWrap}>
          <View style={styles.heatmapCard}>
            <YearHeatmap />
            <View style={styles.legendRow}>
              <Text style={styles.legendLabel}>少ない</Text>
              <View style={styles.legendSwatches}>
                {HEATMAP_LEGEND_COLORS.map((c, i) => (
                  <View
                    key={i}
                    style={[styles.swatch, { backgroundColor: c }]}
                  />
                ))}
              </View>
              <Text style={styles.legendLabel}>多い</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>やらない 別</Text>

        <View style={styles.vowList}>
          {yaranaiData.vows.map((v) => (
            <VowProgressRow key={v.id} vow={v} />
          ))}
        </View>

        <Text style={styles.kept}>
          これまで合計 <Text style={styles.keptShu}>{skipped}</Text> 日、やめた。
        </Text>
      </ScrollView>
    </PaperBg>
  );
}

function VowProgressRow({ vow }: { vow: Vow }) {
  const pct = Math.round((vow.kept / vow.total) * 100);
  return (
    <Pressable
      style={({ pressed }) => [styles.vowRow, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Text style={styles.vowStreak}>{vow.streak}</Text>
      <View style={styles.vowBody}>
        <Text style={styles.vowLabel}>{vow.label}</Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(26,23,21,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: yaranaiFonts.serif,
    fontWeight: "600",
    fontSize: 17,
    color: yaranaiColors.ink,
    letterSpacing: 1,
  },
  heroBlock: {
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 16,
  },
  heroTitle: {
    fontFamily: yaranaiFonts.serif,
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 34,
    color: yaranaiColors.ink,
  },
  heroAccent: {
    color: yaranaiColors.shu,
  },
  heroSub: {
    fontFamily: yaranaiFonts.hand,
    fontSize: 13,
    color: yaranaiColors.ink3,
    marginTop: 6,
  },
  heatmapWrap: {
    paddingHorizontal: 16,
  },
  heatmapCard: {
    backgroundColor: yaranaiColors.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: yaranaiColors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  legendRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  legendLabel: {
    fontFamily: yaranaiFonts.hand,
    fontSize: 10,
    color: yaranaiColors.ink4,
  },
  legendSwatches: {
    flexDirection: "row",
    gap: 3,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  sectionTitle: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 6,
    fontFamily: yaranaiFonts.serif,
    fontSize: 13,
    fontWeight: "600",
    color: yaranaiColors.ink3,
    letterSpacing: 3,
  },
  vowList: {
    paddingHorizontal: 18,
    gap: 8,
  },
  vowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: yaranaiColors.paper,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: yaranaiColors.line,
  },
  vowStreak: {
    minWidth: 36,
    textAlign: "right",
    fontFamily: yaranaiFonts.serif,
    fontSize: 18,
    fontWeight: "700",
    color: yaranaiColors.shu,
  },
  vowBody: {
    flex: 1,
  },
  vowLabel: {
    fontFamily: yaranaiFonts.sans,
    fontSize: 14,
    fontWeight: "500",
    color: yaranaiColors.ink,
  },
  barTrack: {
    marginTop: 6,
    height: 4,
    backgroundColor: yaranaiColors.paper3,
    borderRadius: 2,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: yaranaiColors.shu,
  },
  kept: {
    marginTop: 16,
    textAlign: "center",
    fontFamily: yaranaiFonts.hand,
    fontSize: 12,
    color: yaranaiColors.ink3,
  },
  keptShu: {
    color: yaranaiColors.shu,
    fontFamily: yaranaiFonts.serif,
    fontWeight: "700",
  },
});
