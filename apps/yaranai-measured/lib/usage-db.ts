import * as SQLite from 'expo-sqlite';

// ローカルファースト: 全アプリの詳細な利用ログはこの端末内DBにのみ蓄積する。
// Supabaseに出るのは「誓い対象アプリの日次合計」と「基準線」だけ(usage-sync.ts)。

export type UsageDailyRow = {
  record_date: string;
  package_name: string;
  foreground_ms: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('yaranai-measured.db');
      await db.execAsync(`
        pragma journal_mode = WAL;
        create table if not exists usage_daily (
          record_date text not null,
          package_name text not null,
          foreground_ms integer not null,
          updated_at text not null default (datetime('now')),
          primary key (record_date, package_name)
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

// その日の観測をまるごと置き換える(当日は増え続けるけん洗い替えが安全)。
export async function replaceDay(
  recordDate: string,
  rows: { packageName: string; totalForegroundMs: number }[],
): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('delete from usage_daily where record_date = ?', recordDate);
    for (const row of rows) {
      await tx.runAsync(
        `insert into usage_daily (record_date, package_name, foreground_ms, updated_at)
         values (?, ?, ?, datetime('now'))`,
        recordDate,
        row.packageName,
        Math.round(row.totalForegroundMs),
      );
    }
  });
}

export async function hasAnyDataForDate(recordDate: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'select count(*) as n from usage_daily where record_date = ?',
    recordDate,
  );
  return (row?.n ?? 0) > 0;
}

export async function getRecordedDates(): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ record_date: string }>(
    'select distinct record_date from usage_daily',
  );
  return new Set(rows.map((r) => r.record_date));
}

// 指定日の指定アプリの実測(分)。日付にデータが無ければ null(=取得できなかった日)。
export async function getMinutesForPackage(
  packageName: string,
  recordDate: string,
): Promise<number | null> {
  if (!(await hasAnyDataForDate(recordDate))) return null;
  const db = await getDb();
  const row = await db.getFirstAsync<{ ms: number }>(
    'select foreground_ms as ms from usage_daily where record_date = ? and package_name = ?',
    recordDate,
    packageName,
  );
  return Math.round((row?.ms ?? 0) / 60000);
}

export type WeeklyUsage = {
  packageName: string;
  totalMinutes: number;
  avgMinutesPerDay: number;
  daysWithData: number;
};

// 直近7日(今日を含む)の上位アプリ。「あなたの時間の行き先」の材料。
export async function getWeeklyTopApps(
  sinceRecordDate: string,
  limit: number = 20,
): Promise<WeeklyUsage[]> {
  const db = await getDb();
  const daysRow = await db.getFirstAsync<{ n: number }>(
    'select count(distinct record_date) as n from usage_daily where record_date >= ?',
    sinceRecordDate,
  );
  const days = Math.max(1, daysRow?.n ?? 1);
  const rows = await db.getAllAsync<{ package_name: string; total_ms: number }>(
    `select package_name, sum(foreground_ms) as total_ms
     from usage_daily
     where record_date >= ?
     group by package_name
     order by total_ms desc
     limit ?`,
    sinceRecordDate,
    limit,
  );
  return rows.map((r) => ({
    packageName: r.package_name,
    totalMinutes: Math.round(r.total_ms / 60000),
    avgMinutesPerDay: Math.round(r.total_ms / 60000 / days),
    daysWithData: days,
  }));
}
