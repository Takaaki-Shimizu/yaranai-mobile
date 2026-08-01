import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeGraduationEligibility } from '../graduation';
import {
  RECENT_WINDOW_DAYS,
  getTodayRecordDate,
  graduationWindowDates,
  graduationWindowStart,
  recentWindowDates,
  recentWindowStart,
  recordDateDaysAgo,
} from '../dates';

// 判定窓は「直近7暦日」。テストでは固定の7日を使う(当日 = 2026-08-01 相当)
const WINDOW = [
  '2026-07-26',
  '2026-07-27',
  '2026-07-28',
  '2026-07-29',
  '2026-07-30',
  '2026-07-31',
  '2026-08-01',
];

const allRecorded = new Set(WINDOW);

// ---- 窓の定義(observe と共用) -------------------------------------------

test('候補窓(observe)は当日を含む7暦日', () => {
  assert.equal(RECENT_WINDOW_DAYS, 7);
  const dates = recentWindowDates();
  assert.equal(dates.length, 7);
  // 昇順・重複なし。始まりは observe が getWeeklyTopApps に渡す日と一致する
  assert.deepEqual(dates, [...dates].sort());
  assert.equal(new Set(dates).size, 7);
  assert.equal(dates[0], recentWindowStart());
  assert.equal(dates[dates.length - 1], getTodayRecordDate());
});

test('卒業判定の窓は前日までの7暦日。当日を含まない', () => {
  const dates = graduationWindowDates();
  assert.equal(dates.length, 7);
  assert.deepEqual(dates, [...dates].sort());
  assert.equal(new Set(dates).size, 7);
  assert.equal(dates[0], graduationWindowStart());
  // 終わりは前日。当日を含めると「実質6日と数時間」の判定になってしまう
  assert.equal(dates[dates.length - 1], recordDateDaysAgo(1));
  assert.equal(dates.includes(getTodayRecordDate()), false);
  // 候補窓を1日だけ過去へずらした窓であること(日数の定義は共有)
  assert.deepEqual(dates, [graduationWindowStart(), ...recentWindowDates().slice(0, -1)]);
});

// ---- 成立・不成立 ---------------------------------------------------------

test('7日連続で使用0(行が1日も無い)なら成立', () => {
  assert.equal(
    computeGraduationEligibility({
      windowDates: WINDOW,
      recordedDates: allRecorded,
      foregroundMsByDate: new Map(),
    }),
    true,
  );
});

test('6日使用0 + 1日でも使用があれば不成立', () => {
  assert.equal(
    computeGraduationEligibility({
      windowDates: WINDOW,
      recordedDates: allRecorded,
      foregroundMsByDate: new Map([['2026-07-29', 12 * 60000]]),
    }),
    false,
  );
});

// 分に丸めると0分になる20秒。それでも「開いた」ことに変わりはない
test('窓の末日(当日)に一瞬だけ開いていても不成立', () => {
  assert.equal(
    computeGraduationEligibility({
      windowDates: WINDOW,
      recordedDates: allRecorded,
      foregroundMsByDate: new Map([['2026-08-01', 20_000]]),
    }),
    false,
  );
});

test('窓の外(8日前)の使用は判定に影響しない', () => {
  assert.equal(
    computeGraduationEligibility({
      windowDates: WINDOW,
      recordedDates: allRecorded,
      foregroundMsByDate: new Map([['2026-07-25', 300 * 60000]]),
    }),
    true,
  );
});

// ---- 欠損の扱い -----------------------------------------------------------

test('窓内に観測データが1日も無ければ不成立(「無い」と「使わなかった」を混同しない)', () => {
  assert.equal(
    computeGraduationEligibility({
      windowDates: WINDOW,
      recordedDates: new Set(),
      foregroundMsByDate: new Map(),
    }),
    false,
  );
});

test('窓の外にしか観測が無い場合も不成立', () => {
  assert.equal(
    computeGraduationEligibility({
      windowDates: WINDOW,
      recordedDates: new Set(['2026-07-20', '2026-07-25']),
      foregroundMsByDate: new Map(),
    }),
    false,
  );
});

test('一部の日が欠損でも、記録のある日がすべて使用0なら成立', () => {
  // 7/28〜7/30 は端末未起動などで行が無い。残り4日は記録があり、いずれも使用0
  assert.equal(
    computeGraduationEligibility({
      windowDates: WINDOW,
      recordedDates: new Set(['2026-07-26', '2026-07-27', '2026-07-31', '2026-08-01']),
      foregroundMsByDate: new Map(),
    }),
    true,
  );
});

test('記録のある日が1日だけでも、その日が使用0なら成立', () => {
  assert.equal(
    computeGraduationEligibility({
      windowDates: WINDOW,
      recordedDates: new Set(['2026-08-01']),
      foregroundMsByDate: new Map(),
    }),
    true,
  );
});

test('欠損だらけでも、記録のある日に使用があれば不成立', () => {
  assert.equal(
    computeGraduationEligibility({
      windowDates: WINDOW,
      recordedDates: new Set(['2026-07-31']),
      foregroundMsByDate: new Map([['2026-07-31', 45 * 60000]]),
    }),
    false,
  );
});

// ---- 前景0の行 ------------------------------------------------------------

test('前景0msの行は使用とみなさない(行の有無ではなく前景時間で見る)', () => {
  assert.equal(
    computeGraduationEligibility({
      windowDates: WINDOW,
      recordedDates: allRecorded,
      foregroundMsByDate: new Map([
        ['2026-07-27', 0],
        ['2026-07-30', 0],
      ]),
    }),
    true,
  );
});
