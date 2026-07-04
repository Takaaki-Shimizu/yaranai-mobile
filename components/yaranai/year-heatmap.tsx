import { StyleSheet, Text, View } from "react-native";
import { yaranaiColors, yaranaiFonts } from "@/constants/yaranai-theme";

const ROWS = 7;
const MONTHS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const WEEKS_PER_MONTH = 5;

const seededRandom = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

const heatColor = (lvl: number): string | null => {
  if (lvl < 0) return null;
  if (lvl === 0) return yaranaiColors.paper3;
  // Approximate the design's oklch ramp with tonal vermilion shades.
  const ramp = ["#dec3b4", "#c79277", "#b86c54", "#a14735", "#7d2f23"];
  return ramp[Math.min(lvl - 1, ramp.length - 1)];
};

export function YearHeatmap() {
  const rng = seededRandom(7);
  const currentMonth = new Date().getMonth();

  // Pre-generate the grid: rows × (months × weeks)
  return (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.dowCol} />
        {MONTHS.map((m) => (
          <Text key={m} style={styles.monthLabel}>
            {m}
          </Text>
        ))}
      </View>
      {Array.from({ length: ROWS }, (_, row) => {
        const dowLabel = ["日", "", "水", "", "金", "", ""][row] ?? "";
        return (
          <View key={row} style={styles.row}>
            <View style={styles.dowCol}>
              <Text style={styles.dowLabel}>{dowLabel}</Text>
            </View>
            {MONTHS.map((_, mi) => (
              <View key={mi} style={styles.monthCell}>
                {Array.from({ length: WEEKS_PER_MONTH }, (__, w) => {
                  const v = rng();
                  const isFuture =
                    mi > currentMonth || (mi === currentMonth && w > 2);
                  const lvl = isFuture ? -1 : Math.floor(v * 5);
                  const bg = heatColor(lvl);
                  return (
                    <View
                      key={w}
                      style={[
                        styles.cell,
                        {
                          backgroundColor: bg ?? "transparent",
                          borderWidth: lvl < 0 ? StyleSheet.hairlineWidth : 0,
                          borderStyle: "dashed",
                          borderColor: yaranaiColors.line,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  dowCol: {
    width: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dowLabel: {
    fontFamily: yaranaiFonts.hand,
    fontSize: 9,
    color: yaranaiColors.ink4,
  },
  monthLabel: {
    flex: 1,
    fontFamily: yaranaiFonts.hand,
    fontSize: 9,
    color: yaranaiColors.ink4,
    textAlign: "center",
  },
  monthCell: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 1,
    gap: 2,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 1.5,
  },
});
