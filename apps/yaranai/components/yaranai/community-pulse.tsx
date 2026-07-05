import { StyleSheet, Text, View } from "react-native";

import { yaranaiColors, yaranaiFonts } from "@/constants/yaranai-theme";
import type { CommunityPulseItem } from "@/lib/yaranai-data";

type Props = {
  items: CommunityPulseItem[];
};

export function CommunityPulse({ items }: Props) {
  return (
    <View style={styles.container}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <View
            key={item.label}
            style={[
              styles.row,
              !isLast && styles.rowBorder,
              i > 0 && { paddingTop: 12 },
              !isLast && { paddingBottom: 12 },
            ]}
          >
            <View style={styles.countCol}>
              <Text style={styles.count}>
                {item.count}
                <Text style={styles.countUnit}> 人</Text>
              </Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.note}>{item.note}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: yaranaiColors.paper2,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: yaranaiColors.line,
    paddingHorizontal: 18,
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: yaranaiColors.lineStrong,
    borderStyle: "dashed",
  },
  countCol: {
    minWidth: 56,
    alignItems: "flex-end",
  },
  count: {
    fontFamily: yaranaiFonts.serif,
    fontSize: 22,
    fontWeight: "700",
    color: yaranaiColors.shu,
    letterSpacing: -0.5,
  },
  countUnit: {
    fontSize: 11,
    color: yaranaiColors.ink3,
    fontWeight: "400",
  },
  body: {
    flex: 1,
  },
  label: {
    fontFamily: yaranaiFonts.hand,
    fontSize: 14,
    color: yaranaiColors.ink,
  },
  note: {
    fontFamily: yaranaiFonts.hand,
    fontSize: 11,
    color: yaranaiColors.ink4,
    marginTop: 1,
  },
});
