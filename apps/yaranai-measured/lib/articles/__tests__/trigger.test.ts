import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConfirmedDay,
  isCrashedDay,
  reclaimedMinutes,
  activeVowsOn,
  calendarDaysBetween,
  shouldFireCrashedDay,
  type ConfirmedDay,
  type VowRecord,
  type DailyRecord,
} from '../trigger';

// 「崩れた日」判定に使う素データ。宣言は D より前(§4.2-2)にしておく。
const VOWS: VowRecord[] = [
  { vowId: 'a', baselineMinutes: 54, declaredOn: '2026-07-01', discontinuedOn: null },
  { vowId: 'b', baselineMinutes: 56, declaredOn: '2026-07-01', discontinuedOn: null },
];

// ---------------------------------------------------------------- 崩れた日の定義(§4.2)

test('合計0分の確定日 → 崩れた日', () => {
  // 2誓いとも基準線を超過(取り戻し0)
  const daily: DailyRecord[] = [
    { vowId: 'a', date: '2026-07-17', actualMinutes: 78 },
    { vowId: 'b', date: '2026-07-17', actualMinutes: 61 },
  ];
  const day = buildConfirmedDay('2026-07-17', VOWS, daily);
  assert.equal(day.hasRow, true);
  assert.equal(reclaimedMinutes(day.activeVows), 0);
  assert.equal(isCrashedDay(day), true);
});

test('1誓いだけ1分取り戻し → 崩れた日ではない', () => {
  const daily: DailyRecord[] = [
    { vowId: 'a', date: '2026-07-17', actualMinutes: 53 }, // 54-53 = 1分取り戻し
    { vowId: 'b', date: '2026-07-17', actualMinutes: 61 },
  ];
  const day = buildConfirmedDay('2026-07-17', VOWS, daily);
  assert.equal(reclaimedMinutes(day.activeVows), 1);
  assert.equal(isCrashedDay(day), false);
});

test('行が存在しない日(データ欠損) → 崩れた日ではない', () => {
  const day = buildConfirmedDay('2026-07-17', VOWS, []);
  assert.equal(day.hasRow, false);
  assert.equal(isCrashedDay(day), false);
});

test('宣言前(有効な誓いなし) → 崩れた日ではない', () => {
  // その日に行はあるが、両誓いとも宣言が D 当日=有効誓い0(§4.2-2)
  const vows: VowRecord[] = [
    { vowId: 'a', baselineMinutes: 54, declaredOn: '2026-07-17', discontinuedOn: null },
  ];
  const daily: DailyRecord[] = [{ vowId: 'a', date: '2026-07-17', actualMinutes: 78 }];
  const day = buildConfirmedDay('2026-07-17', vows, daily);
  assert.equal(day.hasRow, true);
  assert.equal(day.activeVows.length, 0);
  assert.equal(isCrashedDay(day), false);
});

test('宣言当日は有効誓いに数えない(宣言翌日から有効)', () => {
  assert.equal(activeVowsOn('2026-07-01', VOWS).length, 0); // 宣言当日
  assert.equal(activeVowsOn('2026-07-02', VOWS).length, 2); // 翌日
});

test('破棄済みの誓いは有効誓いに数えない', () => {
  const vows: VowRecord[] = [
    { vowId: 'a', baselineMinutes: 54, declaredOn: '2026-07-01', discontinuedOn: '2026-07-10' },
  ];
  assert.equal(activeVowsOn('2026-07-17', vows).length, 0);
  assert.equal(activeVowsOn('2026-07-05', vows).length, 1);
});

// ---------------------------------------------------------------- 発火判定(§4.3)

const crashedDay = (date: string): ConfirmedDay =>
  buildConfirmedDay(
    date,
    VOWS,
    [
      { vowId: 'a', date, actualMinutes: 78 },
      { vowId: 'b', date, actualMinutes: 61 },
    ],
  );

test('崩れた日が今日 → 発火(0暦日)', () => {
  assert.equal(
    shouldFireCrashedDay({
      today: '2026-07-18',
      latestConfirmedDay: crashedDay('2026-07-18'),
      alreadyFired: false,
    }),
    true,
  );
});

test('崩れた日が3暦日前 → 発火(境界)', () => {
  assert.equal(calendarDaysBetween('2026-07-15', '2026-07-18'), 3);
  assert.equal(
    shouldFireCrashedDay({
      today: '2026-07-18',
      latestConfirmedDay: crashedDay('2026-07-15'),
      alreadyFired: false,
    }),
    true,
  );
});

test('確定日が4日前 → 発火しない(古い崩れは蒸し返さない)', () => {
  assert.equal(calendarDaysBetween('2026-07-14', '2026-07-18'), 4);
  assert.equal(
    shouldFireCrashedDay({
      today: '2026-07-18',
      latestConfirmedDay: crashedDay('2026-07-14'),
      alreadyFired: false,
    }),
    false,
  );
});

test('崩れていない確定日 → 発火しない', () => {
  const notCrashed = buildConfirmedDay(
    '2026-07-17',
    VOWS,
    [{ vowId: 'a', date: '2026-07-17', actualMinutes: 10 }, // 取り戻しあり
     { vowId: 'b', date: '2026-07-17', actualMinutes: 61 }],
  );
  assert.equal(
    shouldFireCrashedDay({
      today: '2026-07-18',
      latestConfirmedDay: notCrashed,
      alreadyFired: false,
    }),
    false,
  );
});

test('最新の確定日が無い → 発火しない', () => {
  assert.equal(
    shouldFireCrashedDay({ today: '2026-07-18', latestConfirmedDay: null, alreadyFired: false }),
    false,
  );
});

test('既に発火済み → 再発火しない', () => {
  assert.equal(
    shouldFireCrashedDay({
      today: '2026-07-18',
      latestConfirmedDay: crashedDay('2026-07-18'),
      alreadyFired: true,
    }),
    false,
  );
});

test('発火当日に再起動 → 発火しない(冪等)', () => {
  // 発火直後は alreadyFired=true。同じ崩れた日でも二度目は何もしない。
  const day = crashedDay('2026-07-18');
  assert.equal(shouldFireCrashedDay({ today: '2026-07-18', latestConfirmedDay: day, alreadyFired: false }), true);
  assert.equal(shouldFireCrashedDay({ today: '2026-07-18', latestConfirmedDay: day, alreadyFired: true }), false);
});
