import {
  hasUsageAccess,
  isUsageStatsAvailable,
  queryUsageBuckets,
  queryUsageEvents,
} from '../modules/usage-stats';
import { dayRange, getTodayRecordDate, recordDateDaysAgo } from './dates';
import { supabase } from './supabase';
import { aggregateBucketsByDay } from './usage-buckets';
import { aggregateEventsByDay } from './usage-events';
import { getMinutesForPackage, hasAnyDataForDate, replaceDay } from './usage-db';

// 同期は二層。
//   1) syncLocalUsage: OSの利用統計 → 端末内DB(全アプリ、外に出さない)
//   2) syncMeasuredDaily: 端末内DB → Supabase(誓い対象アプリの日次合計のみ)

const LOCAL_SYNC_DAYS = 7; // OSの日次統計・イベントの保持期間に合わせる

// 起動時に直近7日の実測を取り直して端末内DBを埋める。
// 当日は増え続け、昨日以前も遅延集計で変わりうるけん、毎回洗い替える。
//
// 一次ソースは UsageEvents からの自前積み上げ(usage-events.ts)。日次バケットは
// ロールが0時に起きん端末で前日と当日が混ざったまま翌日も開き続け、「昨日」を
// 正確に切り出せんかった(前日へ計上すれば水増し、除外すれば昨日が永遠に未確定)。
// イベント積み上げなら前景区間を0時で割れるけん、日付が変わった瞬間に昨日が確定する。
//
// 日次バケット(INTERVAL_DAILY)は、イベントが残っとらん日の埋め草としてだけ使う。
// イベント由来の正確な値を、日をまたいで混ざりうるバケット値で後から上書きせんよう、
// バケットで書くのは端末DBにまだデータが無い日に限る。
export async function syncLocalUsage(): Promise<void> {
  if (!isUsageStatsAvailable || !hasUsageAccess()) return;
  const now = Date.now();
  const targetDates: string[] = [];
  for (let i = 0; i < LOCAL_SYNC_DAYS; i++) {
    targetDates.push(recordDateDaysAgo(i));
  }
  const { beginMs } = dayRange(targetDates[targetDates.length - 1]);
  const targetSet = new Set(targetDates);
  const byDayFromEvents = aggregateEventsByDay(queryUsageEvents(beginMs, now), targetSet, now);
  const byDayFromBuckets = aggregateBucketsByDay(queryUsageBuckets('daily', beginMs, now), targetSet);
  for (const recordDate of targetDates) {
    // 空の日は書かない: 「データが無い日」と「使わなかった日」を区別できんため。
    // 行が一切ない日は同期対象外(=獲得0)として、嘘をつかない側に倒す。
    const eventRows = byDayFromEvents.get(recordDate);
    if (eventRows && eventRows.length > 0) {
      await replaceDay(recordDate, eventRows);
      continue;
    }
    const bucketRows = byDayFromBuckets.get(recordDate);
    if (bucketRows && bucketRows.length > 0 && !(await hasAnyDataForDate(recordDate))) {
      await replaceDay(recordDate, bucketRows);
    }
  }
}

type ActiveVow = {
  id: string;
  package_name: string;
  declared_on: string;
};

// 誓い対象アプリの「確定した日」(昨日以前)の実測合計をSupabaseへ。
// 当日は未確定(まだ増える)やけん送らない。宣言日以降のみが対象。
// 端末にデータが無い日は行を作らない = その日の獲得は0のまま。
export async function syncMeasuredDaily(userId: string): Promise<void> {
  const today = getTodayRecordDate();
  const { data: vows } = await supabase
    .from('measured_vows')
    .select('id, package_name, declared_on')
    .is('discontinued_on', null);
  if (!vows || vows.length === 0) return;

  const upserts: {
    user_id: string;
    vow_id: string;
    record_date: string;
    actual_minutes: number;
  }[] = [];

  for (const vow of vows as ActiveVow[]) {
    for (let i = 1; i < LOCAL_SYNC_DAYS; i++) {
      const recordDate = recordDateDaysAgo(i);
      if (recordDate >= today) continue;
      if (recordDate < vow.declared_on) continue;
      const minutes = await getMinutesForPackage(vow.package_name, recordDate);
      if (minutes == null) continue;
      upserts.push({
        user_id: userId,
        vow_id: vow.id,
        record_date: recordDate,
        actual_minutes: minutes,
      });
    }
  }

  if (upserts.length > 0) {
    await supabase
      .from('measured_daily')
      .upsert(upserts, { onConflict: 'vow_id,record_date' });
  }
}

// 起動時にまとめて呼ぶ入り口。失敗しても静かに次の起動へ持ち越す。
export async function syncAll(userId: string): Promise<void> {
  try {
    await syncLocalUsage();
    await syncMeasuredDaily(userId);
  } catch {
    // 通信断・権限剥奪などは次回の起動で取り返す。利用者には何も言わない。
  }
}
