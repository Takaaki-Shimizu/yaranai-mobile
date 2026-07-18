// 起動フローの発火評価(実装仕様書 §4.1)。
// usage-sync 完了後に1回だけ呼ぶ。Supabase から最新の確定日ぶんを引き、
// 純関数(trigger.ts)で崩れた日か・発火すべきかを判定し、発火なら状態へ記録する。
//
// 当日データは未確定のため判定に使わない(§4.1)。measured_daily は昨日以前の
// 確定分しか同期されない(usage-sync.ts)ため、最新 record_date = 最新の確定日。

import { supabase } from '../supabase';
import { getTodayRecordDate } from '../dates';
import { ARTICLES } from './registry';
import {
  buildConfirmedDay,
  shouldFireCrashedDay,
  type DailyRecord,
  type VowRecord,
} from './trigger';
import { isFired } from './state';
import { loadArticlesState, recordFired } from './storage';

// crashedDay 発火の記事(v1 は記事2の1本)。将来 registry に増えても拾える。
function crashedDayArticleIds(): string[] {
  return ARTICLES.filter((a) => a.trigger.kind === 'crashedDay').map((a) => a.id);
}

// 起動時に1回呼ぶ。失敗は静かに次の起動へ持ち越す(通信断・権限剥奪など)。
export async function evaluateCrashedDay(): Promise<void> {
  try {
    const targetIds = crashedDayArticleIds();
    if (targetIds.length === 0) return;

    // 未発火の対象記事が無ければ、Supabase を叩かず終える(発火は生涯1回・§4.3)。
    const state = await loadArticlesState();
    const pending = targetIds.filter((id) => !isFired(state, id));
    if (pending.length === 0) return;

    // 最新の確定日(measured_daily の最大 record_date)。
    const { data: latestRows } = await supabase
      .from('measured_daily')
      .select('record_date')
      .order('record_date', { ascending: false })
      .limit(1);
    const latestDate = latestRows?.[0]?.record_date as string | undefined;
    if (!latestDate) return;

    // その確定日の全実測行 + 誓いの素データ(基準線・宣言日・破棄日)。
    const [dailyRes, vowsRes] = await Promise.all([
      supabase
        .from('measured_daily')
        .select('vow_id, actual_minutes')
        .eq('record_date', latestDate),
      supabase
        .from('measured_saved')
        .select('vow_id, baseline_minutes, declared_on, discontinued_on'),
    ]);

    const vows: VowRecord[] = (vowsRes.data ?? []).map((v) => ({
      vowId: v.vow_id as string,
      baselineMinutes: Number(v.baseline_minutes),
      declaredOn: v.declared_on as string,
      discontinuedOn: (v.discontinued_on as string | null) ?? null,
    }));
    const daily: DailyRecord[] = (dailyRes.data ?? []).map((d) => ({
      vowId: d.vow_id as string,
      date: latestDate,
      actualMinutes: Number(d.actual_minutes),
    }));

    const day = buildConfirmedDay(latestDate, vows, daily);
    const today = getTodayRecordDate();
    const firedAt = new Date().toISOString();

    for (const id of pending) {
      if (shouldFireCrashedDay({ today, latestConfirmedDay: day, alreadyFired: false })) {
        await recordFired(id, firedAt);
      }
    }
  } catch {
    // 静かに次の起動へ持ち越す。利用者には何も言わない。
  }
}
