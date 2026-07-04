import { Platform } from "react-native";

export const yaranaiColors = {
  paper: "#faf7f0",
  paper2: "#f4efe2",
  paper3: "#ece4d0",
  washi: "#f6f0df",
  ink: "#1a1715",
  ink2: "#3a342f",
  ink3: "#6a625a",
  ink4: "#a89e92",
  line: "rgba(26,23,21,0.12)",
  lineStrong: "rgba(26,23,21,0.22)",
  shu: "#b8453a",
  shuDeep: "#963228",
  shuSoft: "#f4d8d2",
  shuTint: "#f9e8e3",
  gold: "#b89968",
} as const;

export const yaranaiFonts = {
  serif: Platform.select({
    ios: "Hiragino Mincho ProN",
    android: "serif",
    default: "serif",
  }),
  hand: Platform.select({
    ios: "Hiragino Mincho ProN",
    android: "serif",
    default: "serif",
  }),
  sans: Platform.select({
    ios: "Hiragino Sans",
    android: "sans-serif",
    default: "System",
  }),
  label: Platform.select({
    ios: "Snell Roundhand",
    android: "cursive",
    default: "cursive",
  }),
} as const;
