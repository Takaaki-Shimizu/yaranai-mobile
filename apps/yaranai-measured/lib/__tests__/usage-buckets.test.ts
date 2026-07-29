import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS } from '../dates';
import {
  aggregateBucketsByDay,
  averageMinutesPerDay,
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

test('日次集計: 日をまたいで伸びる未ロールバケットを前日へ丸ごと足さない', () => {
  // 端末が0時に起きとらんと、OSは [前日0時, now] の1本に前日+当日を混ぜて返す。
  // これを前日へ丸ごと足すと、当日を使うほど前日の実測が水増しされ、
  // 「戻ってきた時間」が減る(この誓いの表示が減る不具合の再現)。
  const targetDates = targetDatesFrom([2026, 6, 30], 7); // 6/30〜7/6(7/6視点)
  const nowMs = ms(2026, 7, 6) + 15 * 3600000; // 7/6 15:00
  const buckets: UsageBucket[] = [
    // 7/5(前日)0時に始まり、まだ閉じず now まで伸びとる混合バケット。
    // 中身は前日90分 + 当日ぶんが混ざっとる(ここでは合計200分)。
    bucket(YT, ms(2026, 7, 5), nowMs, 200),
  ];
  const byDay = aggregateBucketsByDay(buckets, targetDates);
  // 前日(7/5)へ200分を計上してはいけない。混合バケットは捨てる。
  assert.equal(byDay.has('2026-07-05'), false);
  assert.equal(totalMinutesFor(byDay, YT), 0);
});

test('日次集計: 翌0時ちょうど(や数分のズレ)で閉じた確定バケットは通す', () => {
  const targetDates = targetDatesFrom([2026, 6, 30], 7);
  const buckets: UsageBucket[] = [
    // ロールが5分遅れて 7/6 00:05 に閉じた 7/5 の確定バケット。
    bucket(YT, ms(2026, 7, 5), ms(2026, 7, 6) + 5 * 60000, 90),
    // 当日(7/6)の進行中バケット(翌0時前なので日内)。
    bucket(YT, ms(2026, 7, 6), ms(2026, 7, 6) + 15 * 3600000, 40),
  ];
  const byDay = aggregateBucketsByDay(buckets, targetDates);
  assert.deepEqual(byDay.get('2026-07-05'), [{ packageName: YT, totalForegroundMs: min(90) }]);
  assert.deepEqual(byDay.get('2026-07-06'), [{ packageName: YT, totalForegroundMs: min(40) }]);
});

test('日次集計: ロールが朝まで遅れて締まった前日の確定バケットは捨てない', () => {
  // 端末が0時に寝とると、前日バケットは翌朝(最初に統計が更新された時刻)に
  // 締まり、lastTimeStamp が翌0時を数時間越えるのが正規の挙動。
  // これを終端だけ見て捨てると前日のデータが恒久的に消え、ホームが
  // 「昨日の実測を待っています」から永遠に進まんくなる(この不具合の再現)。
  const targetDates = targetDatesFrom([2026, 6, 30], 7); // 6/30〜7/6(7/6視点)
  const rollMs = ms(2026, 7, 6) + 7 * 3600000 + 45 * 60000; // 7/6 07:45 に締まった
  const buckets: UsageBucket[] = [
    // 7/5 の確定バケット。翌朝 07:45 締め(猶予30分を大きく超える)。
    bucket(YT, ms(2026, 7, 5), rollMs, 90),
    // ロール後に始まった当日(7/6)の進行中バケット。
    bucket(YT, rollMs, rollMs + 30 * 60000, 10),
  ];
  const byDay = aggregateBucketsByDay(buckets, targetDates);
  assert.deepEqual(byDay.get('2026-07-05'), [{ packageName: YT, totalForegroundMs: min(90) }]);
  assert.deepEqual(byDay.get('2026-07-06'), [{ packageName: YT, totalForegroundMs: min(10) }]);
});

test('日次集計: 再起動で割れた前日の後半バケットも、ロール後は通す', () => {
  const targetDates = targetDatesFrom([2026, 6, 30], 7);
  const rollMs = ms(2026, 7, 6) + 8 * 3600000; // 7/6 08:00 に締まった
  const buckets: UsageBucket[] = [
    // 7/5 前半(再起動前)と後半(再起動後、翌朝締め)。
    bucket(YT, ms(2026, 7, 5), ms(2026, 7, 5) + 14 * 3600000, 40),
    bucket(YT, ms(2026, 7, 5) + 14 * 3600000, rollMs, 50),
    // ロール後の当日バケット。
    bucket(YT, rollMs, rollMs + 3600000, 5),
  ];
  const byDay = aggregateBucketsByDay(buckets, targetDates);
  assert.deepEqual(byDay.get('2026-07-05'), [{ packageName: YT, totalForegroundMs: min(90) }]);
});

test('基準線: 粗い粒度は捨てずに、重なりぶんを引いた残差で12週の窓を埋める', () => {
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
    bucket(YT, ms(2026, 6, 29), ms(2026, 7, 6), 500), // 日次で埋まっとる週 → 新しく数えるものはない
  ];
  const monthly: UsageBucket[] = [
    bucket(YT, ms(2026, 4, 1), ms(2026, 5, 1), 3000), // 窓の縁をまたぐ → 4/13〜5/1 で切って按分
    bucket(YT, ms(2026, 5, 1), ms(2026, 6, 1), 1550), // 5月まるごと → そのまま
    bucket(YT, ms(2026, 6, 1), ms(2026, 7, 1), 1500), // 週次・日次と重なる → 残差だけ
    bucket(YT, ms(2026, 7, 1), now, 300), // 日次で埋まっとる → 新しく数えるものはない
  ];

  const stitched = stitchBaselineWindow({ daily, weekly, monthly }, beginMs, now);

  // 窓は月次で端から端まで覆えるけん、集計できた期間は84日ちょうど
  // (旧実装は重なった月次を丸ごと捨てて59日しか覆えず、日によって段で動いとった)
  assert.equal(coveredDaysOf(stitched), 84);
  // 合計 = 日次420 + 週次1050 + 4月按分1800(3000×18/30) + 5月1550
  //        + 6月の残差330(1500 −(週次1050 + 6/29・6/30の日次120))= 5150分
  assert.equal((stitched.totalMsByPackage.get(YT) ?? 0) / 60000, 5150);
  assert.equal(averageMinutesPerDay(stitched, YT), 61.3);
});

test('基準線: 窓の縁をまたぐ月次バケットを捨てず、窓で切って按分する', () => {
  // 旧実装は firstTimeStamp が窓外なら丸ごと捨てとった。beginMs は毎日1日ずつ進むけん、
  // 月初を越えた日に30日ぶんの覆いが一度に消え、availableDays がガクンと落ちとった。
  const now = ms(2026, 7, 6);
  const beginMs = now - 84 * DAY_MS; // = 2026-04-13
  const monthly = [bucket(YT, ms(2026, 4, 1), ms(2026, 5, 1), 3000)];
  const stitched = stitchBaselineWindow({ daily: [], weekly: [], monthly }, beginMs, now);
  assert.equal(coveredDaysOf(stitched), 18); // 4/13〜5/1
  assert.equal((stitched.totalMsByPackage.get(YT) ?? 0) / 60000, 1800); // 3000 × 18/30
});

test('基準線: 細かい粒度と重なる月次バケットは、重なりぶんを引いた残差だけ数える', () => {
  const now = ms(2026, 7, 1);
  const beginMs = now - 84 * DAY_MS;
  const weekly = [
    bucket(YT, ms(2026, 6, 8), ms(2026, 6, 15), 420),
    bucket(YT, ms(2026, 6, 15), ms(2026, 6, 22), 350),
    bucket(YT, ms(2026, 6, 22), ms(2026, 6, 29), 280),
  ];
  const monthly = [bucket(YT, ms(2026, 6, 1), ms(2026, 7, 1), 1500)];
  const stitched = stitchBaselineWindow({ daily: [], weekly, monthly }, beginMs, now);
  // 覆えた期間 = 6月まるごと30日(旧実装は月次を丸ごと捨てて21日しか覆えんかった)
  assert.equal(coveredDaysOf(stitched), 30);
  // 合計 = 週次1050 + 残差450 = 1500分。二重計上もせず、月次の実測も落とさない
  assert.equal((stitched.totalMsByPackage.get(YT) ?? 0) / 60000, 1500);
});

test('基準線: 同じ日でパッケージごとに期間がずれた日次バケットを丸ごと捨てない', () => {
  // 端末によっては、同じ日次ファイルでもパッケージごとに first/last が
  // 「その日に実際に使った時間帯」でずれて返ることがある。
  // 旧実装は最初の期間(いちばん早く使い始めたアプリ)だけを数え、
  // 重なる残りの期間を丸ごと捨てとったけん、TikTok などの実測が0になり、
  // 直近7日に使っとるのに観測画面の候補から消えとった(この不具合の再現)。
  const now = ms(2026, 7, 6);
  const beginMs = now - 84 * DAY_MS;
  const LINE = 'jp.naver.line.android';
  const TIKTOK = 'com.ss.android.ugc.trill';
  const h = 3600000;
  const daily: UsageBucket[] = [
    bucket(LINE, ms(2026, 7, 5) + 6 * h, ms(2026, 7, 5) + 23 * h, 25),
    bucket(TIKTOK, ms(2026, 7, 5) + 7 * h, ms(2026, 7, 5) + 22 * h, 90),
    bucket(YT, ms(2026, 7, 5) + 12 * h, ms(2026, 7, 5) + 18 * h, 60),
  ];
  const stitched = stitchBaselineWindow({ daily, weekly: [], monthly: [] }, beginMs, now);
  assert.equal((stitched.totalMsByPackage.get(LINE) ?? 0) / 60000, 25);
  assert.equal((stitched.totalMsByPackage.get(TIKTOK) ?? 0) / 60000, 90);
  assert.equal((stitched.totalMsByPackage.get(YT) ?? 0) / 60000, 60);
  // 覆っとる時間は期間の和集合(6時〜23時)。併合しても二重には数えない。
  assert.equal(stitched.coveredMs, 17 * h);
});

test('基準線: ロール遅延で前日バケットと重なって始まる当日バケットも数える', () => {
  // ロールが朝まで遅れた端末では、前日バケットが翌朝に締まる一方、
  // 当日バケットは0時起点へ遡って作られ、期間が重なることがある。
  // 旧実装やと当日バケットが「二重」とみなされ丸ごと捨てられとった。
  const h = 3600000;
  const now = ms(2026, 7, 6) + 15 * h;
  const beginMs = now - 84 * DAY_MS;
  const daily: UsageBucket[] = [
    bucket(YT, ms(2026, 7, 5), ms(2026, 7, 6) + 7 * h + 45 * 60000, 90), // 前日、翌朝7:45締め
    bucket(YT, ms(2026, 7, 6), now, 40), // 当日、0時起点で前日と重なる
  ];
  const stitched = stitchBaselineWindow({ daily, weekly: [], monthly: [] }, beginMs, now);
  assert.equal((stitched.totalMsByPackage.get(YT) ?? 0) / 60000, 130);
  // 和集合 = 7/5 0:00 〜 7/6 15:00 の39時間
  assert.equal(stitched.coveredMs, 39 * h);
});

test('12週平均: 記録が無いアプリと空の窓は0分になる(観測画面の除外条件)', () => {
  const now = ms(2026, 7, 6);
  const beginMs = now - 84 * DAY_MS;
  const daily = [bucket(YT, ms(2026, 7, 5), ms(2026, 7, 6), 60)];
  const stitched = stitchBaselineWindow({ daily, weekly: [], monthly: [] }, beginMs, now);
  assert.equal(averageMinutesPerDay(stitched, 'com.example.unknown'), 0);
  const empty = stitchBaselineWindow({ daily: [], weekly: [], monthly: [] }, beginMs, now);
  assert.equal(averageMinutesPerDay(empty, YT), 0);
});

// Android の保持期間(日次7日・週次4週・月次6ヶ月)どおりにバケットを作る。
// 日次は暦日、週次は日曜起点、月次は月初起点。最新の1本だけが now まで開いとる。
function deviceBuckets(now: number) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const daily: UsageBucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const start = todayMs - i * DAY_MS;
    daily.push(bucket(YT, start, i === 0 ? now : start + DAY_MS, 60));
  }

  const weekStart = todayMs - new Date(todayMs).getDay() * DAY_MS;
  const weekly: UsageBucket[] = [];
  for (let i = 3; i >= 0; i--) {
    const start = weekStart - i * 7 * DAY_MS;
    weekly.push(bucket(YT, start, i === 0 ? now : start + 7 * DAY_MS, 420));
  }

  const monthStarts: number[] = [];
  for (let i = 5; i >= 0; i--) {
    monthStarts.push(new Date(today.getFullYear(), today.getMonth() - i, 1).getTime());
  }
  const monthly = monthStarts.map((start, i) =>
    bucket(YT, start, i + 1 < monthStarts.length ? monthStarts[i + 1] : now, 1800),
  );

  return { daily, weekly, monthly };
}

test('基準線: 日が変わっても集計日数が段で落ちない(12週平均が急に消える不具合の再現)', () => {
  // 報告された症状: 昨日まで出とった「時間の行き先」が、翌朝には28日ゲートに落ちた。
  // 原因は availableDays が暦の進みに対して単調やなく、週次1本(7日)・月次1本(30日)の
  // 単位で採否が反転しとったこと。閾値28の near では日によって出たり消えたりする。
  // 月境界・週境界・月末月初をまたぐ2ヶ月ぶんを1日ずつ舐めて、84日で動かんことを確かめる。
  for (let i = 0; i < 70; i++) {
    const now = ms(2026, 5, 20) + i * DAY_MS + 9 * 3600000 + 49 * 60000;
    const stitched = stitchBaselineWindow(deviceBuckets(now), now - 84 * DAY_MS, now);
    assert.equal(
      coveredDaysOf(stitched),
      84,
      `${new Date(now).toISOString().slice(0, 10)} の集計日数が84日でない`,
    );
  }
});

test('基準線: 履歴が浅い端末では、集計日数が1日ずつ増えて減らない', () => {
  // 端末を使い始めた直後。ゲートを跨ぐ前後で行ったり来たりせず、単調に増える。
  const historyStart = ms(2026, 6, 1);
  let prev = 0;
  for (let i = 1; i <= 45; i++) {
    const now = historyStart + i * DAY_MS + 9 * 3600000;
    const all = deviceBuckets(now);
    const clip = (list: UsageBucket[]) =>
      list
        .filter((b) => b.lastTimeStamp > historyStart)
        .map((b) => ({ ...b, firstTimeStamp: Math.max(b.firstTimeStamp, historyStart) }));
    const stitched = stitchBaselineWindow(
      { daily: clip(all.daily), weekly: clip(all.weekly), monthly: clip(all.monthly) },
      now - 84 * DAY_MS,
      now,
    );
    const days = coveredDaysOf(stitched);
    assert.equal(days, i, `${i}日目の集計日数が ${days} 日`);
    assert.ok(days >= prev, `${i}日目に集計日数が ${prev} → ${days} と減った`);
    prev = days;
  }
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
