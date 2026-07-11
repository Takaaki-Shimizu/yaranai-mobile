import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateEventsByDay,
  EVENT_ACTIVITY_PAUSED,
  EVENT_ACTIVITY_RESUMED,
  EVENT_ACTIVITY_STOPPED,
  EVENT_DEVICE_SHUTDOWN,
  EVENT_SCREEN_NON_INTERACTIVE,
  type UsageEvent,
} from '../usage-events';

const YT = 'com.google.android.youtube';
const LINE = 'jp.naver.line.android';

// ローカルタイムゾーンでエポックmsを作る(toRecordDateもローカル基準)
function ms(y: number, m: number, d: number, h = 0, mi = 0): number {
  return new Date(y, m - 1, d, h, mi, 0, 0).getTime();
}

function ev(
  pkg: string,
  eventType: number,
  timestampMs: number,
  className: string | null = 'MainActivity',
): UsageEvent {
  return { packageName: pkg, className, eventType, timestampMs };
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

function minutesOf(
  byDay: Map<string, { packageName: string; totalForegroundMs: number }[]>,
  recordDate: string,
  pkg: string,
): number {
  const rows = byDay.get(recordDate) ?? [];
  const row = rows.find((r) => r.packageName === pkg);
  return (row?.totalForegroundMs ?? 0) / 60000;
}

test('イベント集計: RESUMED→PAUSED の区間を日ごとに積む', () => {
  const targetDates = targetDatesFrom([2026, 7, 5], 7);
  const events: UsageEvent[] = [
    ev(YT, EVENT_ACTIVITY_RESUMED, ms(2026, 7, 10, 21, 0)),
    ev(YT, EVENT_ACTIVITY_PAUSED, ms(2026, 7, 10, 21, 40)),
    ev(YT, EVENT_ACTIVITY_RESUMED, ms(2026, 7, 10, 22, 0)),
    ev(YT, EVENT_ACTIVITY_PAUSED, ms(2026, 7, 10, 22, 20)),
  ];
  const byDay = aggregateEventsByDay(events, targetDates, ms(2026, 7, 11, 12, 0));
  assert.equal(minutesOf(byDay, '2026-07-10', YT), 60);
});

test('イベント集計: 0時をまたぐ区間は前日と当日へ正確に割れる', () => {
  // これが日次バケットでは原理的にできんかったこと。ロールが遅れる端末でも
  // イベントなら 23:30〜00:20 の50分を「前日30分・当日20分」へ割れる。
  const targetDates = targetDatesFrom([2026, 7, 5], 7);
  const events: UsageEvent[] = [
    ev(YT, EVENT_ACTIVITY_RESUMED, ms(2026, 7, 10, 23, 30)),
    ev(YT, EVENT_ACTIVITY_PAUSED, ms(2026, 7, 11, 0, 20)),
  ];
  const byDay = aggregateEventsByDay(events, targetDates, ms(2026, 7, 11, 12, 0));
  assert.equal(minutesOf(byDay, '2026-07-10', YT), 30);
  assert.equal(minutesOf(byDay, '2026-07-11', YT), 20);
});

test('イベント集計: 同一アプリ内のアクティビティ遷移で区間を途切れさせない', () => {
  // 遷移は RESUMED(B) → PAUSED(A) の順で来る。Aの PAUSED で閉じたら
  // 連続視聴が細切れになるけん、前景集合が空になるまで区間を保つ。
  const targetDates = targetDatesFrom([2026, 7, 5], 7);
  const events: UsageEvent[] = [
    ev(YT, EVENT_ACTIVITY_RESUMED, ms(2026, 7, 10, 20, 0), 'HomeActivity'),
    ev(YT, EVENT_ACTIVITY_RESUMED, ms(2026, 7, 10, 20, 30), 'PlayerActivity'),
    ev(YT, EVENT_ACTIVITY_PAUSED, ms(2026, 7, 10, 20, 30), 'HomeActivity'),
    ev(YT, EVENT_ACTIVITY_PAUSED, ms(2026, 7, 10, 21, 0), 'PlayerActivity'),
    ev(YT, EVENT_ACTIVITY_STOPPED, ms(2026, 7, 10, 21, 0), 'PlayerActivity'),
  ];
  const byDay = aggregateEventsByDay(events, targetDates, ms(2026, 7, 11, 12, 0));
  assert.equal(minutesOf(byDay, '2026-07-10', YT), 60);
});

test('イベント集計: 画面消灯・シャットダウンは開いとる区間を全部閉じる', () => {
  const targetDates = targetDatesFrom([2026, 7, 5], 7);
  const events: UsageEvent[] = [
    // PAUSED が来んままのアプリ2本(プロセスkillなど)
    ev(YT, EVENT_ACTIVITY_RESUMED, ms(2026, 7, 9, 10, 0)),
    ev(LINE, EVENT_ACTIVITY_RESUMED, ms(2026, 7, 9, 10, 10)),
    ev('', EVENT_SCREEN_NON_INTERACTIVE, ms(2026, 7, 9, 10, 30), null),
    // 翌日、シャットダウンで閉じる区間
    ev(YT, EVENT_ACTIVITY_RESUMED, ms(2026, 7, 10, 9, 0)),
    ev('', EVENT_DEVICE_SHUTDOWN, ms(2026, 7, 10, 9, 15), null),
  ];
  const byDay = aggregateEventsByDay(events, targetDates, ms(2026, 7, 11, 12, 0));
  assert.equal(minutesOf(byDay, '2026-07-09', YT), 30);
  assert.equal(minutesOf(byDay, '2026-07-09', LINE), 20);
  assert.equal(minutesOf(byDay, '2026-07-10', YT), 15);
});

test('イベント集計: 窓の始まりより前から前景やった断片(先頭のPAUSEDだけ)は数えない', () => {
  const targetDates = targetDatesFrom([2026, 7, 5], 7);
  const events: UsageEvent[] = [
    ev(YT, EVENT_ACTIVITY_PAUSED, ms(2026, 7, 5, 0, 10)),
    ev(YT, EVENT_ACTIVITY_RESUMED, ms(2026, 7, 5, 8, 0)),
    ev(YT, EVENT_ACTIVITY_PAUSED, ms(2026, 7, 5, 8, 30)),
  ];
  const byDay = aggregateEventsByDay(events, targetDates, ms(2026, 7, 11, 12, 0));
  assert.equal(minutesOf(byDay, '2026-07-05', YT), 30);
});

test('イベント集計: endMs でまだ開いとる区間は打ち切って当日ぶんとして数える', () => {
  const targetDates = targetDatesFrom([2026, 7, 5], 7);
  const nowMs = ms(2026, 7, 11, 12, 30);
  const events: UsageEvent[] = [
    ev(YT, EVENT_ACTIVITY_RESUMED, ms(2026, 7, 11, 12, 0)),
  ];
  const byDay = aggregateEventsByDay(events, targetDates, nowMs);
  assert.equal(minutesOf(byDay, '2026-07-11', YT), 30);
});

test('イベント集計: targetDates に無い日のぶんは捨てる', () => {
  const targetDates = targetDatesFrom([2026, 7, 10], 2); // 7/10〜7/11 だけ
  const events: UsageEvent[] = [
    ev(YT, EVENT_ACTIVITY_RESUMED, ms(2026, 7, 9, 23, 0)),
    ev(YT, EVENT_ACTIVITY_PAUSED, ms(2026, 7, 10, 1, 0)),
  ];
  const byDay = aggregateEventsByDay(events, targetDates, ms(2026, 7, 11, 12, 0));
  assert.equal(byDay.has('2026-07-09'), false);
  assert.equal(minutesOf(byDay, '2026-07-10', YT), 60);
});

test('イベント集計: 順不同で届いたイベントも時刻順に並べて再生する', () => {
  const targetDates = targetDatesFrom([2026, 7, 5], 7);
  const events: UsageEvent[] = [
    ev(YT, EVENT_ACTIVITY_PAUSED, ms(2026, 7, 10, 21, 40)),
    ev(YT, EVENT_ACTIVITY_RESUMED, ms(2026, 7, 10, 21, 0)),
  ];
  const byDay = aggregateEventsByDay(events, targetDates, ms(2026, 7, 11, 12, 0));
  assert.equal(minutesOf(byDay, '2026-07-10', YT), 40);
});

test('イベント集計: className が欠けるイベント(旧端末)も数えられる', () => {
  const targetDates = targetDatesFrom([2026, 7, 5], 7);
  const events: UsageEvent[] = [
    ev(YT, EVENT_ACTIVITY_RESUMED, ms(2026, 7, 10, 21, 0), null),
    ev(YT, EVENT_ACTIVITY_PAUSED, ms(2026, 7, 10, 21, 25), null),
  ];
  const byDay = aggregateEventsByDay(events, targetDates, ms(2026, 7, 11, 12, 0));
  assert.equal(minutesOf(byDay, '2026-07-10', YT), 25);
});
