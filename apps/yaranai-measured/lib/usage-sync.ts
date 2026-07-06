import { hasUsageAccess, isUsageStatsAvailable, queryUsageBuckets } from '../modules/usage-stats';
import { dayRange, getTodayRecordDate, recordDateDaysAgo } from './dates';
import { supabase } from './supabase';
import { aggregateBucketsByDay } from './usage-buckets';
import { getMinutesForPackage, replaceDay } from './usage-db';

// 同期は二層。
//   1) syncLocalUsage: OSの利用統計 → 端末内DB(全アプリ、外に出さない)
//   2) syncMeasuredDaily: 端末内DB → Supabase(誓い対象アプリの日次合計のみ)

const LOCAL_SYNC_DAYS = 7; // OSの日次バケット保持期間に合わせる

// 起動時に直近7日の日次バケットを取り直して端末内DBを埋める。
// 当日は増え続け、昨日以前も遅延集計で変わりうるけん、毎回洗い替える。
//
// クエリは INTERVAL_DAILY の生バケットで取り、firstTimeStamp が直近7日(暦日)に
// 入るものだけを日ごとに合算する。以前の queryAndAggregateUsageStats は範囲に
// 重なる週次バケットを丸ごと返すことがあり、週合計が実際より膨らんどった。
export async function syncLocalUsage(): Promise<void> {
  if (!isUsageStatsAvailable || !hasUsageAccess()) return;
  const now = Date.now();
  const targetDates: string[] = [];
  for (let i = 0; i < LOCAL_SYNC_DAYS; i++) {
    targetDates.push(recordDateDaysAgo(i));
  }
  const { beginMs } = dayRange(targetDates[targetDates.length - 1]);
  const buckets = queryUsageBuckets('daily', beginMs, now);
  const byDay = aggregateBucketsByDay(buckets, new Set(targetDates));
  for (const recordDate of targetDates) {
    const rows = byDay.get(recordDate);
    // 空の日は書かない: 「データが無い日」と「使わなかった日」を区別できんため。
    // 行が一切ない日は同期対象外(=獲得0)として、嘘をつかない側に倒す。
    if (rows && rows.length > 0) {
      await replaceDay(recordDate, rows);
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
