import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVowLog,
  buildVowLogFromDailyRows,
  dailySavedMinutes,
  formatFullDate,
  formatMonthDay,
  listRecordDates,
  stepChartPaths,
  totalSavedMinutes,
  type VowLogEntry,
} from '../vow-log';

// ---- 日付の列挙 ----------------------------------------------------------

test('listRecordDates は両端を含み昇順で列挙する', () => {
  assert.deepEqual(listRecordDates('2026-07-10', '2026-07-12'), [
    '2026-07-10',
    '2026-07-11',
    '2026-07-12',
  ]);
  assert.deepEqual(listRecordDates('2026-07-10', '2026-07-10'), ['2026-07-10']);
});

test('listRecordDates は月またぎ・年またぎを正しく渡る', () => {
  assert.deepEqual(listRecordDates('2026-07-30', '2026-08-02'), [
    '2026-07-30',
    '2026-07-31',
    '2026-08-01',
    '2026-08-02',
  ]);
  assert.deepEqual(listRecordDates('2025-12-31', '2026-01-01'), ['2025-12-31', '2026-01-01']);
});

test('listRecordDates は from > to(宣言当日など確定日なし)で空', () => {
  assert.deepEqual(listRecordDates('2026-07-12', '2026-07-11'), []);
});

// ---- 日次値(per-appクリップ) -------------------------------------------

test('dailySavedMinutes = max(0, 基準線 − 実測)。超過日は0で下限を割らない', () => {
  assert.equal(dailySavedMinutes(60, 20), 40);
  assert.equal(dailySavedMinutes(60, 60), 0);
  assert.equal(dailySavedMinutes(60, 90), 0);
  assert.equal(dailySavedMinutes(0, 0), 0);
});

test('クリップはアプリごと: 片方超過・片方節約の同日を相殺しない', () => {
  // 誓いA: 基準線60分・実測90分(超過) / 誓いB: 基準線60分・実測10分(節約)
  // (a) per-appクリップ: 0 + 50 = 50分
  // (b) 合算後クリップなら max(0, 120 − 100) = 20分 になってしまう。(a)が正
  const a = dailySavedMinutes(60, 90);
  const b = dailySavedMinutes(60, 10);
  assert.equal(a + b, 50);
  assert.ok(a + b !== Math.max(0, 60 + 60 - (90 + 10)));
});

// ---- 日別ログ(3態と累積) -----------------------------------------------

const args = {
  declaredOn: '2026-07-10',
  lastConfirmedDate: '2026-07-14',
  baselineMinutes: 60,
};

test('buildVowLog: 記録なし日を挟んでも累積は横ばいで途切れない', () => {
  const log = buildVowLog({
    ...args,
    // 7/12 はどのアプリの行も無い日(端末未起動) = 記録なし
    recordedDates: new Set(['2026-07-10', '2026-07-11', '2026-07-13', '2026-07-14']),
    actualMinutesByDate: new Map([
      ['2026-07-10', 20], // +40
      ['2026-07-11', 50], // +10
      ['2026-07-13', 0], // +60
      ['2026-07-14', 30], // +30
    ]),
  });
  assert.deepEqual(
    log.map((e) => [e.date, e.state, e.savedMinutes, e.cumulativeMinutes]),
    [
      ['2026-07-10', 'saved', 40, 40],
      ['2026-07-11', 'saved', 10, 50],
      ['2026-07-12', 'none', 0, 50], // 横ばい。0分の濡れ衣を着せない
      ['2026-07-13', 'saved', 60, 110],
      ['2026-07-14', 'saved', 30, 140],
    ],
  );
  assert.equal(totalSavedMinutes(log), 140);
});

test('buildVowLog: 実測が基準線以上の日は獲得0(zero)。記録なしと混同しない', () => {
  const log = buildVowLog({
    ...args,
    lastConfirmedDate: '2026-07-12',
    recordedDates: new Set(['2026-07-10', '2026-07-11', '2026-07-12']),
    actualMinutesByDate: new Map([
      ['2026-07-10', 60], // ちょうど基準線 → 0
      ['2026-07-11', 90], // 超過 → 0(下がらない)
      ['2026-07-12', 45], // +15
    ]),
  });
  assert.deepEqual(
    log.map((e) => [e.state, e.savedMinutes, e.cumulativeMinutes]),
    [
      ['zero', 0, 0],
      ['zero', 0, 0],
      ['saved', 15, 15],
    ],
  );
});

test('buildVowLog: 他アプリの行はあるが対象アプリの行が無い日は実測0分(まるごと取り戻し)', () => {
  // hasAnyDataForDate の意味論: その日に何かの行があれば「記録あり」。
  // 対象アプリの行だけ無いのは「開かんかった日」であって欠測ではない。
  const log = buildVowLog({
    ...args,
    lastConfirmedDate: '2026-07-10',
    recordedDates: new Set(['2026-07-10']),
    actualMinutesByDate: new Map(),
  });
  assert.deepEqual(
    log.map((e) => [e.state, e.savedMinutes, e.cumulativeMinutes]),
    [['saved', 60, 60]],
  );
});

test('buildVowLog: 累積は単調非減少。日別値の総和が累計と一致する(検算)', () => {
  const log = buildVowLog({
    ...args,
    recordedDates: new Set(['2026-07-10', '2026-07-12', '2026-07-14']),
    actualMinutesByDate: new Map([
      ['2026-07-10', 10],
      ['2026-07-12', 120],
      ['2026-07-14', 55],
    ]),
  });
  for (let i = 1; i < log.length; i++) {
    assert.ok(log[i].cumulativeMinutes >= log[i - 1].cumulativeMinutes);
  }
  const sum = log.reduce((acc, e) => acc + e.savedMinutes, 0);
  assert.equal(sum, totalSavedMinutes(log));
});

test('buildVowLog: 宣言当日(確定日なし)は空。累計0', () => {
  const log = buildVowLog({
    declaredOn: '2026-07-31',
    lastConfirmedDate: '2026-07-30',
    baselineMinutes: 60,
    recordedDates: new Set(),
    actualMinutesByDate: new Map(),
  });
  assert.deepEqual(log, [] as VowLogEntry[]);
  assert.equal(totalSavedMinutes(log), 0);
});

// ---- サーバー行からの組み立て --------------------------------------------

test('buildVowLogFromDailyRows: 行がある日は記録あり、行がない日は none で横ばい', () => {
  const log = buildVowLogFromDailyRows({
    ...args,
    rows: [
      { record_date: '2026-07-10', actual_minutes: 20 }, // +40
      { record_date: '2026-07-11', actual_minutes: 90 }, // 超過 → 0 (zero)
      // 7/12 は行なし = 記録なし(欠測)
      { record_date: '2026-07-13', actual_minutes: 0 }, // 開かんかった日 → +60
      { record_date: '2026-07-14', actual_minutes: 30 }, // +30
    ],
  });
  assert.deepEqual(
    log.map((e) => [e.date, e.state, e.savedMinutes, e.cumulativeMinutes]),
    [
      ['2026-07-10', 'saved', 40, 40],
      ['2026-07-11', 'zero', 0, 40],
      ['2026-07-12', 'none', 0, 40],
      ['2026-07-13', 'saved', 60, 100],
      ['2026-07-14', 'saved', 30, 130],
    ],
  );
});

test('buildVowLogFromDailyRows: 累計が measured_saved ビューの合算と一致する(検算)', () => {
  // ビューは sum(greatest(0, baseline − actual)) を行の有無に関わらず全行で取る。
  // この画面の累計も同じ行・同じクリップで組むけん、必ず同じ値になる。
  const rows = [
    { record_date: '2026-07-10', actual_minutes: 10 },
    { record_date: '2026-07-12', actual_minutes: 120 },
    { record_date: '2026-07-14', actual_minutes: 55 },
  ];
  const log = buildVowLogFromDailyRows({ ...args, rows });
  const viewSum = rows.reduce((sum, r) => sum + Math.max(0, 60 - r.actual_minutes), 0);
  assert.equal(totalSavedMinutes(log), viewSum);
});

// ---- 階段グラフ ----------------------------------------------------------

// パス文字列から y 座標列を抜く(M/L の第2成分)
function yCoords(d: string): number[] {
  return [...d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => parseFloat(m[2]));
}

test('stepChartPaths: y は単調非増加(画面座標で「1pxたりとも下がらない」)', () => {
  const { line } = stepChartPaths([40, 50, 50, 110, 140], 300, 160);
  const ys = yCoords(line);
  for (let i = 1; i < ys.length; i++) {
    assert.ok(ys[i] <= ys[i - 1], `y[${i}]=${ys[i]} > y[${i - 1}]=${ys[i - 1]}`);
  }
  // 始点は底(値0)、終点は天(最終累計)
  assert.equal(ys[0], 160);
  assert.equal(ys[ys.length - 1], 0);
});

test('stepChartPaths: 横ばいの日(獲得0・記録なし)は段が立たない', () => {
  const { line } = stepChartPaths([30, 30, 30], 300, 160);
  // 段は初日の1回だけ。以後は同じ高さの横線が続く
  const ys = yCoords(line);
  assert.deepEqual([...new Set(ys)], [160, 0]);
});

test('stepChartPaths: 全日0なら底辺に沿う一本の横線', () => {
  const { line } = stepChartPaths([0, 0, 0], 300, 160);
  const ys = yCoords(line);
  assert.ok(ys.every((y) => y === 160));
});

test('stepChartPaths: 空列でも壊れない(底辺の横線)', () => {
  const { line, area } = stepChartPaths([], 300, 160);
  assert.ok(line.length > 0);
  assert.ok(area.endsWith('Z'));
});

// ---- 日付表記 ------------------------------------------------------------

test('formatFullDate / formatMonthDay', () => {
  assert.equal(formatFullDate('2026-07-05', 'ja'), '2026年7月5日');
  assert.equal(formatFullDate('2026-07-05', 'en'), 'July 5, 2026');
  assert.equal(formatMonthDay('2026-12-03', 'ja'), '12月3日');
  assert.equal(formatMonthDay('2026-12-03', 'en'), 'Dec 3');
});
