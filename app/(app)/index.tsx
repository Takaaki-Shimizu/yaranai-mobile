import { useCallback, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Garden } from '@/components/Garden';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { getTodayRecordDate } from '../../lib/dates';
import { colors, fonts } from '../../lib/theme';

type Item = {
  id: string;
  label: string;
  minutes_per_day: number;
};

type Totals = {
  total_saved_hours: number;
  longest_days: number;
  phase: number;
};

type RecordStatus = 'kept' | 'broken';

export default function Home() {
  const session = useSession();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [records, setRecords] = useState<Record<string, RecordStatus>>({});
  const [totals, setTotals] = useState<Totals | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const today = getTodayRecordDate();

  const loadTotals = useCallback(async () => {
    const { data } = await supabase.from('garden_state').select('*').maybeSingle();
    setTotals(data ?? null);
  }, []);

  const loadAll = useCallback(async () => {
    const [itemsRes, recordsRes] = await Promise.all([
      supabase
        .from('yaranai_items')
        .select('id, label, minutes_per_day')
        .eq('is_focused', true)
        .is('discontinued_at', null)
        .order('created_at', { ascending: true }),
      supabase
        .from('daily_records')
        .select('yaranai_item_id, status')
        .eq('record_date', today),
    ]);
    setItems(itemsRes.data ?? []);
    const map: Record<string, RecordStatus> = {};
    (recordsRes.data ?? []).forEach((r) => {
      map[r.yaranai_item_id] = r.status as RecordStatus;
    });
    setRecords(map);
    await loadTotals();
  }, [today, loadTotals]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  // タップ即反映(楽観的更新)、裏で書き込み、失敗時だけ巻き戻す
  const toggle = async (item: Item, status: RecordStatus) => {
    if (!session) return;
    const prev = { ...records };
    const current = records[item.id];

    if (current === status) {
      // 同じ状態をもう一度タップ = 取り消し(行を消して「記録なし=kept」に戻る)
      setRecords((r) => {
        const next = { ...r };
        delete next[item.id];
        return next;
      });
      const { error } = await supabase
        .from('daily_records')
        .delete()
        .eq('yaranai_item_id', item.id)
        .eq('record_date', today);
      if (error) setRecords(prev);
    } else {
      setRecords((r) => ({ ...r, [item.id]: status }));
      const { error } = await supabase.from('daily_records').upsert(
        {
          user_id: session.user.id,
          yaranai_item_id: item.id,
          record_date: today,
          status,
          source: 'focused_daily',
        },
        { onConflict: 'yaranai_item_id,record_date' }
      );
      if (error) setRecords(prev);
    }
    loadTotals();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const phase = totals?.phase ?? 0.05;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.wordmark}>Yaranai</Text>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOut}>退出</Text>
        </Pressable>
      </View>

      {/* 蓄積 */}
      <View style={styles.garden}>
        {totals && totals.total_saved_hours > 0 ? (
          <>
            <Text style={styles.headline}>
              {totals.longest_days}日で、{totals.total_saved_hours}時間が{'\n'}戻ってきました。
            </Text>
            <View style={{ marginTop: 32, width: '100%' }}>
              <Garden phase={phase} />
            </View>
          </>
        ) : (
          <Text style={styles.headline}>ここから、始まる。</Text>
        )}
      </View>

      {/* 今日の記録 */}
      <View style={styles.list}>
        {items.map((item) => {
          const current = records[item.id];
          return (
            <View key={item.id} style={styles.row}>
              <View style={styles.rowHead}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.minutes}>{item.minutes_per_day}分/日</Text>
              </View>
              <View style={styles.buttons}>
                <Pressable
                  style={[styles.btn, current === 'kept' && styles.btnKept]}
                  onPress={() => toggle(item, 'kept')}
                >
                  <Text style={[styles.btnText, current === 'kept' && styles.btnKeptText]}>
                    やらない
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, current === 'broken' && styles.btnBroken]}
                  onPress={() => toggle(item, 'broken')}
                >
                  <Text style={[styles.btnText, current === 'broken' && styles.btnBrokenText]}>
                    NG
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {items.length < 3 && (
          <Pressable style={styles.declare} onPress={() => router.push('/(app)/vows/new')}>
            <Text style={styles.declareText}>やらない、を宣言する</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.footnote}>記録がない日は、守った日。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.kinari },
  content: { paddingHorizontal: 28, paddingTop: 64, paddingBottom: 80 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  wordmark: { fontFamily: fonts.serif, fontSize: 16, letterSpacing: 6, color: colors.sumi },
  signOut: { fontSize: 11, color: colors.usuzumi, letterSpacing: 2 },

  garden: { paddingVertical: 72, alignItems: 'center' },
  headline: {
    fontFamily: fonts.serif,
    fontSize: 22,
    lineHeight: 40,
    letterSpacing: 2,
    color: colors.sumi,
    textAlign: 'center',
  },
  list: { gap: 28 },
  row: { gap: 12 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontFamily: fonts.serif, fontSize: 17, color: colors.sumi, letterSpacing: 1 },
  minutes: { fontSize: 11, color: colors.usuzumi },
  buttons: { flexDirection: 'row', gap: 12 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.suna,
  },
  btnText: { fontFamily: fonts.serif, fontSize: 14, color: colors.usuzumi, letterSpacing: 3 },
  btnKept: { backgroundColor: colors.keptBg, borderColor: colors.keptBg },
  btnKeptText: { color: colors.sumi },
  btnBroken: { backgroundColor: colors.shu, borderColor: colors.shu },
  btnBrokenText: { color: colors.kinari },

  declare: {
    marginTop: 8,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.usuzumi,
    borderStyle: 'dashed',
  },
  declareText: { fontFamily: fonts.serif, fontSize: 14, color: colors.sumi, letterSpacing: 4 },

  footnote: {
    marginTop: 56,
    textAlign: 'center',
    fontSize: 11,
    color: colors.usuzumi,
    letterSpacing: 2,
  },
});
