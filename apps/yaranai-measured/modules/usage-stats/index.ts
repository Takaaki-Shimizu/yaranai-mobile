import { requireOptionalNativeModule } from 'expo-modules-core';

export type AppUsage = {
  packageName: string;
  totalForegroundMs: number;
};

type UsageStatsNativeModule = {
  hasUsageAccess(): boolean;
  openUsageAccessSettings(): void;
  queryUsage(beginMs: number, endMs: number): AppUsage[];
};

// Android実機(dev client)以外ではネイティブモジュールが存在せんけん、
// 例外を投げずに「利用不可」へ倒す。Expo Goでは常に null になる。
const NativeUsageStats =
  requireOptionalNativeModule<UsageStatsNativeModule>('UsageStats');

export const isUsageStatsAvailable = NativeUsageStats != null;

export function hasUsageAccess(): boolean {
  return NativeUsageStats?.hasUsageAccess() ?? false;
}

export function openUsageAccessSettings(): void {
  NativeUsageStats?.openUsageAccessSettings();
}

export function queryUsage(beginMs: number, endMs: number): AppUsage[] {
  return NativeUsageStats?.queryUsage(beginMs, endMs) ?? [];
}
