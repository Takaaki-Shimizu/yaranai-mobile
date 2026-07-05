import { StyleSheet, View } from "react-native";
import { yaranaiColors } from "@/constants/yaranai-theme";

type Props = {
  heat?: number[];
  size?: number;
  cols?: number;
  rows?: number;
};

export function MiniHeatmap({ heat = [], size = 42, cols = 6, rows = 7 }: Props) {
  const total = cols * rows;
  const cells: number[] =
    heat.length > 0
      ? heat.slice(0, total).concat(Array(Math.max(0, total - heat.length)).fill(0))
      : Array.from({ length: total }, () => 0);
  const gap = 2;
  const cell = (size - (cols - 1) * gap) / cols;

  return (
    <View style={[styles.grid, { width: size, height: size, gap }]}>
      {cells.map((v, i) => (
        <View
          key={i}
          style={{
            width: cell,
            height: cell,
            borderRadius: 1.5,
            backgroundColor:
              v === 2
                ? yaranaiColors.shu
                : v === 1
                  ? yaranaiColors.ink
                  : yaranaiColors.paper3,
            opacity: v === 0 ? 0.5 : 1,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
