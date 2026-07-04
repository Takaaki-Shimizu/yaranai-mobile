import { Tabs } from "expo-router";
import React from "react";

import { YaranaiTabBar } from "@/components/yaranai/yaranai-tabbar";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <YaranaiTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "いま" }} />
      <Tabs.Screen name="kiseki" options={{ title: "きせき" }} />
    </Tabs>
  );
}
