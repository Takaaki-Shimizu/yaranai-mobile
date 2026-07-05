import { StyleSheet, View, ViewProps } from "react-native";
import { yaranaiColors } from "@/constants/yaranai-theme";

export function PaperBg({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.bg, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: yaranaiColors.paper,
  },
});
