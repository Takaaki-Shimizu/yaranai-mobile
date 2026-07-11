import { requireOptionalNativeModule } from 'expo-modules-core';
import type { UsageBucket } from '../../lib/usage-buckets';
import type { UsageEvent } from '../../lib/usage-events';

export type { UsageBucket, UsageEvent };

// UsageStatsManager の INTERVAL_DAILY / WEEKLY / MONTHLY に対応
const INTERVAL_CODE = { daily: 0, weekly: 1, monthly: 2 } as const;
export type UsageInterval = keyof typeof INTERVAL_CODE;

type UsageStatsNativeModule = {
  hasUsageAccess(): boolean;
  openUsageAccessSettings(): void;
  queryUsageBuckets(intervalType: number, beginMs: number, endMs: number): UsageBucket[];
  queryUsageEvents(beginMs: number, endMs: number): UsageEvent[];
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

// 生バケットをそのまま返す。範囲に重なるバケットが丸ごと混ざるけん、
// 範囲内の判定・集計は lib/usage-buckets.ts の純粋関数に任せる。
export function queryUsageBuckets(
  interval: UsageInterval,
  beginMs: number,
  endMs: number,
): UsageBucket[] {
  return NativeUsageStats?.queryUsageBuckets(INTERVAL_CODE[interval], beginMs, endMs) ?? [];
}

// 前景イベントの生列をそのまま返す。日ごとの積み上げは lib/usage-events.ts の
// 純粋関数に任せる(バケットと同じ分担)。
export function queryUsageEvents(beginMs: number, endMs: number): UsageEvent[] {
  return NativeUsageStats?.queryUsageEvents(beginMs, endMs) ?? [];
}
