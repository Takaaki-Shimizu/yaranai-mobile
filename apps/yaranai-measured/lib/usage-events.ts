import { dayRange, toRecordDate } from './dates';
import type { DailyAppUsage } from './usage-buckets';

// UsageEvents.Event のイベント種別。値はAPIレベルで不変。
// RESUMED/PAUSED は API 29 未満の MOVE_TO_FOREGROUND/BACKGROUND と同じ値(1/2)。
export const EVENT_ACTIVITY_RESUMED = 1;
export const EVENT_ACTIVITY_PAUSED = 2;
export const EVENT_SCREEN_NON_INTERACTIVE = 16;
export const EVENT_ACTIVITY_STOPPED = 23;
export const EVENT_DEVICE_SHUTDOWN = 26;

// ネイティブ層が返す生イベント。className は古いイベントや旧端末では欠けることがある。
export type UsageEvent = {
  packageName: string;
  className: string | null;
  eventType: number;
  timestampMs: number;
};

// 前景イベントの再生で、暦日ごと・アプリごとの前景時間(ms)を自前で積み上げる。
//
// 日次バケット(INTERVAL_DAILY)を使わん理由: ロールが0時に起きん端末では
// [前日0時, now] の1本に前日と当日が混ざったまま、翌日の昼になっても開き続ける。
// 開いとる間は前日へ計上すれば当日ぶんが水増しされ、除外すれば前日が
// 「昨日の実測を待っています」のまま永遠に確定せん。イベントからの積み上げなら
// 前景の区間を0時で正確に割れるけん、日付が変わった瞬間に昨日が確定する。
//
// 再生の規則:
//   - RESUMED でそのアプリの前景アクティビティ集合に加え、集合が空→非空になった
//     時刻を区間の始まりとする(同一アプリ内のアクティビティ遷移で途切れさせない)
//   - PAUSED/STOPPED で集合から除き、空になった時刻で区間を閉じる
//   - 画面消灯・端末シャットダウンは開いとる区間を全部その時刻で閉じる
//     (プロセスkillなどで PAUSED が来んまま放置される区間の膨張を防ぐ)
//   - 窓の始まりより前から前景やった断片(先頭の PAUSED だけ来る)は数えない。
//     確かめようが無いけん、過少(嘘をつかない)側に倒す
//   - endMs(=now)でまだ開いとる区間はそこで打ち切って数える(当日の進行中ぶん)
export function aggregateEventsByDay(
  events: UsageEvent[],
  targetDates: ReadonlySet<string>,
  endMs: number,
): Map<string, DailyAppUsage[]> {
  const byDay = new Map<string, Map<string, number>>();

  // 前景区間 [start, end) を暦日で割って積む。targetDates に無い日のぶんは捨てる。
  const addInterval = (packageName: string, start: number, end: number) => {
    let cursor = start;
    while (cursor < end) {
      const recordDate = toRecordDate(new Date(cursor));
      const { endMs: dayEnd } = dayRange(recordDate);
      const chunkEnd = Math.min(end, dayEnd);
      if (targetDates.has(recordDate) && chunkEnd > cursor) {
        const perApp = byDay.get(recordDate) ?? new Map<string, number>();
        perApp.set(packageName, (perApp.get(packageName) ?? 0) + (chunkEnd - cursor));
        byDay.set(recordDate, perApp);
      }
      cursor = chunkEnd;
    }
  };

  // アプリごとの「いま前景にあるアクティビティ集合」と、前景になった時刻。
  const open = new Map<string, { classes: Set<string>; since: number }>();
  const sorted = [...events].sort((a, b) => a.timestampMs - b.timestampMs);
  for (const ev of sorted) {
    if (ev.eventType === EVENT_ACTIVITY_RESUMED) {
      const state = open.get(ev.packageName);
      if (state) {
        state.classes.add(ev.className ?? '');
      } else {
        open.set(ev.packageName, {
          classes: new Set([ev.className ?? '']),
          since: ev.timestampMs,
        });
      }
    } else if (
      ev.eventType === EVENT_ACTIVITY_PAUSED ||
      ev.eventType === EVENT_ACTIVITY_STOPPED
    ) {
      const state = open.get(ev.packageName);
      if (!state) continue; // 窓の始まりより前から前景やった断片は数えない
      state.classes.delete(ev.className ?? '');
      if (state.classes.size === 0) {
        addInterval(ev.packageName, state.since, ev.timestampMs);
        open.delete(ev.packageName);
      }
    } else if (
      ev.eventType === EVENT_SCREEN_NON_INTERACTIVE ||
      ev.eventType === EVENT_DEVICE_SHUTDOWN
    ) {
      for (const [packageName, state] of open) {
        addInterval(packageName, state.since, ev.timestampMs);
      }
      open.clear();
    }
  }
  // まだ開いとる区間(当日の進行中)は now で打ち切って数える
  for (const [packageName, state] of open) {
    addInterval(packageName, state.since, endMs);
  }

  const result = new Map<string, DailyAppUsage[]>();
  for (const [recordDate, perApp] of byDay) {
    result.set(
      recordDate,
      [...perApp]
        .filter(([, totalForegroundMs]) => totalForegroundMs > 0)
        .map(([packageName, totalForegroundMs]) => ({ packageName, totalForegroundMs })),
    );
  }
  return result;
}
