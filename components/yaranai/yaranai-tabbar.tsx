import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { yaranaiColors, yaranaiFonts } from "@/constants/yaranai-theme";

type RouteTab = {
  kind: "route";
  label: string;
  routeName: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFilled: keyof typeof Ionicons.glyphMap;
};
type StubTab = {
  kind: "stub";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFilled: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};
type BrushTab = { kind: "brush"; onPress: () => void };
type Tab = RouteTab | StubTab | BrushTab;

const stubAlert = (title: string) =>
  Alert.alert(title, "この画面は、まだ準備中です。", [{ text: "閉じる" }]);

export function YaranaiTabBar({
  state,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const tabs: Tab[] = [
    {
      kind: "route",
      label: "いま",
      routeName: "index",
      icon: "home-outline",
      iconFilled: "home",
    },
    {
      kind: "route",
      label: "きせき",
      routeName: "kiseki",
      icon: "calendar-outline",
      iconFilled: "calendar",
    },
    {
      kind: "brush",
      onPress: () => stubAlert("宣言する"),
    },
    {
      kind: "stub",
      label: "みちしるべ",
      icon: "compass-outline",
      iconFilled: "compass",
      onPress: () => stubAlert("みちしるべ"),
    },
    {
      kind: "stub",
      label: "わたし",
      icon: "person-outline",
      iconFilled: "person",
      onPress: () => stubAlert("わたし"),
    },
  ];

  const activeRouteName = state.routes[state.index]?.name;

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      <View style={styles.row}>
        {tabs.map((t, i) => {
          if (t.kind === "brush") {
            return (
              <Pressable
                key={`brush-${i}`}
                style={({ pressed }) => [
                  styles.brushBtn,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={t.onPress}
              >
                <View style={styles.brushCircle}>
                  <Ionicons
                    name="brush"
                    size={26}
                    color={yaranaiColors.paper}
                  />
                </View>
              </Pressable>
            );
          }

          const isActive =
            t.kind === "route" && activeRouteName === t.routeName;

          const onPress = () => {
            if (t.kind === "route") {
              const event = navigation.emit({
                type: "tabPress",
                target: state.routes.find((r) => r.name === t.routeName)?.key ??
                  "",
                canPreventDefault: true,
              });
              if (!isActive && !event.defaultPrevented) {
                navigation.navigate(t.routeName);
              }
            } else {
              t.onPress();
            }
          };

          return (
            <Pressable
              key={`${t.kind}-${i}`}
              style={({ pressed }) => [
                styles.tabBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={onPress}
            >
              <Ionicons
                name={isActive ? t.iconFilled : t.icon}
                size={24}
                color={isActive ? yaranaiColors.ink : yaranaiColors.ink4}
              />
              <Text
                style={[
                  styles.label,
                  {
                    color: isActive ? yaranaiColors.ink : yaranaiColors.ink4,
                  },
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: yaranaiColors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: yaranaiColors.line,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 4,
  },
  label: {
    fontSize: 10,
    fontFamily: yaranaiFonts.hand,
    fontWeight: "600",
  },
  brushBtn: {
    marginBottom: -4,
    paddingHorizontal: 4,
  },
  brushCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: yaranaiColors.shu,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: yaranaiColors.shu,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 6,
  },
});
