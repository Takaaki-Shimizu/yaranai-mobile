import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS } from '../dates';
import {
  aggregateBucketsByDay,
  coveredDaysOf,
  stitchBaselineWindow,
  type UsageBucket,
} from '../usage-buckets';

// 期待値は Digital Wellbeing の実測(2026年):
//   YouTube 6/21週(6/21〜6/27): 5時間32分
//   YouTube 6/28週(6/28〜7/4) : 10時間03分
// バグ発生時のアプリ表示は 17時間52分 ≒ 5:32 + 10:03 + 7/5以降の約2:17。
// = 範囲に重なる週次バケットが丸ごと混入した合計と一致する。

const YT = 'com.google.android.youtube';

// ローカルタイムゾーンでエポックmsを作る(toRecordDateもローカル基準)
function ms(y: number, m: number, d: number): number {
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function min(n: number): number {
  return n * 60000;
}

function bucket(
  pkg: string,
  first: number,
  last: number,
  foregroundMinutes: number,
): UsageBucket {
  return {
    packageName: pkg,
    firstTimeStamp: first,
    lastTimeStamp: last,
    totalForegroundMs: min(foregroundMinutes),
  };
}

function targetDatesFrom(firstDay: [number, number, number], days: number): Set<string> {
  const dates = new Set<string>();
  const [y, m, d] = firstDay;
  for (let i = 0; i < days; i++) {
    const date = new Date(y, m - 1, d + i);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    dates.add(`${date.getFullYear()}-${mm}-${dd}`);
  }
  return dates;
}

function totalMinutesFor(byDay: Map<string, { packageName: string; totalForegroundMs: number }[]>, pkg: string): number {
  let total = 0;
  for (const rows of byDay.values()) {
    for (const row of rows) {
      if (row.packageName === pkg) total += row.totalForegroundMs;
    }
  }
  return total / 60000;
}

test('週次集計: 範囲外から混入した週次バケットを除外する(17:52→2:17の再現)', () => {
  // 窓: 6/30〜7/6 の7日(7/6視点)
  const targetDates = targetDatesFrom([2026, 6, 30], 7);
  const buckets: UsageBucket[] = [
    // 旧実装で混入しとった週次バケット(実測値そのもの)
    bucket(YT, ms(2026, 6, 21), ms(2026, 6, 28), 5 * 60 + 32), // 6/21週 5:32
    bucket(YT, ms(2026, 6, 28), ms(2026, 7, 5), 10 * 60 + 3), // 6/28週 10:03
    // 窓内の正しい日次バケット(7/5以降 ≒ 2:17)
    bucket(YT, ms(2026, 7, 5), ms(2026, 7, 6), 70), // 7/5 1:10
    bucket(YT, ms(2026, 7, 6), ms(2026, 7, 6) + 8 * 3600000, 67), // 7/6(当日) 1:07
  ];

  // 旧実装(全バケット合算)なら 17:52 になっとった
  const naiveTotal = buckets.reduce((sum, b) => sum + b.totalForegroundMs, 0) / 60000;
  assert.equal(naiveTotal, 17 * 60 + 52);

  // 新実装: firstTimeStamp が窓内の日次バケットだけを合算 → 2:17
  const byDay = aggregateBucketsByDay(buckets, targetDates);
  assert.equal(totalMinutesFor(byDay, YT), 2 * 60 + 17);
  assert.equal(byDay.has('2026-06-28'), false, '窓より前の日は書かない');
  assert.deepEqual(
    byDay.get('2026-07-05'),
    [{ packageName: YT, totalForegroundMs: min(70) }],
  );
});

test('週次集計: 6/28週の日次内訳の合計が実測 10:03 に一致する', () => {
  // 日次内訳(合計が実測 10時間03分 = 603分 になる想定値)
  const daily: [number, number][] = [
    [28, 95],
    [29, 120],
    [30, 60],
  ];
  const dailyJuly: [number, number][] = [
    [1, 88],
    [2, 110],
    [3, 70],
    [4, 60],
  ];
  const buckets: UsageBucket[] = [
    ...daily.map(([d, m]) => bucket(YT, ms(2026, 6, d), ms(2026, 6, d + 1), m)),
    ...dailyJuly.map(([d, m]) => bucket(YT, ms(2026, 7, d), ms(2026, 7, d + 1), m)),
  ];
  const byDay = aggregateBucketsByDay(buckets, targetDatesFrom([2026, 6, 28], 7));
  assert.equal(totalMinutesFor(byDay, YT), 10 * 60 + 3);
  assert.equal(byDay.size, 7);
});

test('週次集計: 同じ暦日に複数の日次バケットがあれば合算する(再起動など)', () => {
  const buckets: UsageBucket[] = [
    bucket(YT, ms(2026, 7, 5), ms(2026, 7, 5) + 10 * 3600000, 40),
    bucket(YT, ms(2026, 7, 5) + 10 * 3600000, ms(2026, 7, 6), 30),
  ];
  const byDay = aggregateBucketsByDay(buckets, targetDatesFrom([2026, 6, 30], 7));
  assert.deepEqual(byDay.get('2026-07-05'), [
    { packageName: YT, totalForegroundMs: min(70) },
  ]);
});

test('基準線: 窓の外から始まる月次バケットを混入させず、重複なしで継ぎ足す', () => {
  const now = ms(2026, 7, 6);
  const beginMs = now - 84 * DAY_MS; // = 2026-04-13

  const daily: UsageBucket[] = [];
  for (let d = 0; d < 7; d++) {
    // 6/29〜7/5 の日次バケット、各60分
    daily.push(bucket(YT, ms(2026, 6, 29) + d * DAY_MS, ms(2026, 6, 30) + d * DAY_MS, 60));
  }
  const weekly: UsageBucket[] = [
    bucket(YT, ms(2026, 6, 8), ms(2026, 6, 15), 420),
    bucket(YT, ms(2026, 6, 15), ms(2026, 6, 22), 350),
    bucket(YT, ms(2026, 6, 22), ms(2026, 6, 29), 280),
    bucket(YT, ms(2026, 6, 29), ms(2026, 7, 6), 500), // 日次で数え済みの週 → 捨てる
  ];
  const monthly: UsageBucket[] = [
    bucket(YT, ms(2026, 4, 1), ms(2026, 5, 1), 3000), // 窓の外(4/1 < 4/13)から始まる → 捨てる
    bucket(YT, ms(2026, 5, 1), ms(2026, 6, 1), 1550), // 5月まるごと → 使う
    bucket(YT, ms(2026, 6, 1), ms(2026, 7, 1), 1500), // 週次と重なる → 捨てる
    bucket(YT, ms(2026, 7, 1), now, 300), // 日次と重なる → 捨てる
  ];

  const stitched = stitchBaselineWindow({ daily, weekly, monthly }, beginMs, now);

  // 集計できた期間 = 日次7日 + 週次21日 + 5月31日 = 59日
  assert.equal(coveredDaysOf(stitched), 59);
  // 合計 = 7×60 + (420+350+280) + 1550 = 3020分(4月・6月・7月の月次は入らない)
  assert.equal((stitched.totalMsByPackage.get(YT) ?? 0) / 60000, 3020);
  // 1日平均 = 3020 / 59 ≒ 51.2分(旧実装なら4月の3000分が丸ごと混入しとった)
  const avg = Math.round(((stitched.totalMsByPackage.get(YT) ?? 0) / 60000 / (stitched.coveredMs / DAY_MS)) * 10) / 10;
  assert.equal(avg, 51.2);
});

test('基準線: 日次しか残っとらん端末は集計日数がそのまま少なく出る(宣言不可判定用)', () => {
  const now = ms(2026, 7, 6);
  const beginMs = now - 84 * DAY_MS;
  const daily: UsageBucket[] = [];
  for (let d = 0; d < 5; d++) {
    daily.push(bucket(YT, ms(2026, 7, 1) + d * DAY_MS, ms(2026, 7, 2) + d * DAY_MS, 30));
  }
  const stitched = stitchBaselineWindow({ daily, weekly: [], monthly: [] }, beginMs, now);
  assert.equal(coveredDaysOf(stitched), 5);
});
