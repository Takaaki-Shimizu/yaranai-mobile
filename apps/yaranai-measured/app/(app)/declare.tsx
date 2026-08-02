import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSession, colors, fonts } from '@yaranai/core';
import { Sumiire, useSumiireRouter } from '../../components/Sumiire';
import { supabase } from '../../lib/supabase';
import { computeBaseline, type BaselineResult, BASELINE_MIN_DAYS } from '../../lib/baseline';
import { formatMinutes } from '../../lib/format';
import { useLang, useT } from '../../lib/i18n/context';
import { isMissingGraduatedOn, MAX_VOWS } from '../../lib/vows';
import { markOnboardingDone } from '../../lib/onboarding';

// 卒業済みの誓い(卒業機能 §5-3)。この画面は宣言と復帰の二役を持つ。
// 同じパッケージに生きた誓いがあるなら新規宣言はありえん(unique index が弾く)ので、
// 復帰モードで描く。基準線はいかなる経路でも再計算しない(五原則3)。
type GraduatedVow = {
  id: string;
  baseline_minutes: number;
};

export default function Declare() {
  const session = useSession();
  const router = useSumiireRouter();
  const { lang } = useLang();
  const t = useT();
  const params = useLocalSearchParams<{
    packageName?: string;
    label?: string;
    onboarding?: string;
  }>();
  const packageName = typeof params.packageName === 'string' ? params.packageName : '';
  const label = typeof params.label === 'string' ? params.label : packageName;
  // オンボーディング文脈(時間の行き先から引き継ぐ)。宣言を終えたあと、庭へ入る前に
  // 理想を書く画面を一度だけ通す(オンボーディング §6)。書かずに飛ばしてもよい
  const onboarding = params.onboarding === '1';

  const [baseline, setBaseline] = useState<BaselineResult | null>(null);
  const [graduated, setGraduated] = useState<GraduatedVow | null>(null);
  // 復帰の可否を先に確かめる間は、宣言のUIも復帰のUIも出さない(ちらつき防止)
  const [checking, setChecking] = useState(true);
  const [slotsOpen, setSlotsOpen] = useState(true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // このパッケージに卒業済みの誓いがあれば復帰モード、無ければ新規宣言。
  // 復帰なら基準線は再計算せず、宣言時に固定された値をそのまま出す(五原則3)。
  useEffect(() => {
    if (!packageName) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    // マイグレーション 003 未適用の Supabase では graduated_on 列が無く 42703 で
    // 落ちるけん、そのときだけ旧スキーマとして引き直す。旧スキーマに卒業済みは
    // 存在せんけん、既存行 = 挑戦中、生きた誓い = 枠を占める誓い、でよい。
    const fetchExisting = async () => {
      const full = await supabase
        .from('measured_vows')
        .select('id, baseline_minutes, graduated_on')
        .eq('package_name', packageName)
        .is('discontinued_on', null)
        .maybeSingle();
      if (!isMissingGraduatedOn(full.error)) return full;
      const legacy = await supabase
        .from('measured_vows')
        .select('id, baseline_minutes')
        .eq('package_name', packageName)
        .is('discontinued_on', null)
        .maybeSingle();
      return {
        ...legacy,
        data: legacy.data ? { ...legacy.data, graduated_on: null } : null,
      };
    };
    const fetchActiveCount = async () => {
      const full = await supabase
        .from('measured_vows')
        .select('id', { count: 'exact', head: true })
        .is('discontinued_on', null)
        .is('graduated_on', null);
      if (!isMissingGraduatedOn(full.error)) return full;
      return supabase
        .from('measured_vows')
        .select('id', { count: 'exact', head: true })
        .is('discontinued_on', null);
    };
    (async () => {
      // 枠の担保はDBトリガーが唯一の正。count は満杯を先に伝えるための補助で、
      // 押してから断られるより、押せんと分かっとるほうが静かやけん置いとる。
      const [existing, active] = await Promise.all([fetchExisting(), fetchActiveCount()]);
      if (cancelled) return;
      const row = existing.data;
      if (row?.graduated_on) {
        setGraduated({ id: row.id as string, baseline_minutes: row.baseline_minutes as number });
        setSlotsOpen((active.count ?? 0) < MAX_VOWS);
      } else {
        // 基準線は宣言時スナップショット。この画面で見た平均が、そのまま固定される。
        setBaseline(computeBaseline(packageName));
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [packageName]);

  const declare = async () => {
    if (!session || !packageName || baseline?.status !== 'ok') return;
    setBusy(true);
    setMessage('');
    const { error } = await supabase.from('measured_vows').insert({
      user_id: session.user.id,
      package_name: packageName,
      app_label: label,
      baseline_minutes: baseline.averageMinutesPerDay,
      baseline_window_days: baseline.windowDays,
    });
    setBusy(false);

    if (error) {
      // アクティブ3本超過はDBトリガーが止める(DB側のメッセージは日本語固定)
      if (error.message.includes('手元におけるのは最大3つまで')) {
        setMessage(t.declare.limitReached);
      } else {
        setMessage(t.declare.failed);
      }
      return;
    }
    // 宣言1本でオンボーディングは完走(オンボーディング §6)。完了済みなら何も変わらん
    await markOnboardingDone(session.user.id);
    // 宣言の完了。世界観の一文を添えた完了画面を挟んでから庭へ戻る(§変更5)
    setDone(true);
  };

  // 復帰(卒業機能 §5-3)。graduated_on を NULL に戻すフリップだけ。行の作り直しも
  // 再宣言もせん ── declared_on も基準線も、宣言したその日のまま動かない。
  // 儀式は宣言のときに一度済んどるけん、完了画面は挟まず静かに庭へ還す。
  const restore = async () => {
    if (!graduated || busy) return;
    setBusy(true);
    setMessage('');
    const { error } = await supabase
      .from('measured_vows')
      .update({ graduated_on: null })
      .eq('id', graduated.id);
    setBusy(false);

    if (error) {
      // 挑戦中3本の状態での復帰はDBトリガーが止める(DB側のメッセージは日本語固定)
      if (error.message.includes('手元におけるのは最大3つまで')) {
        setMessage(t.declare.limitReached);
      } else {
        setMessage(t.declare.restoreFailed);
      }
      return;
    }
    router.replace('/(app)/(tabs)');
  };

  // 宣言(断つ)の儀式の完了画面。
  // どの分岐もルートは同型の Sumiire(墨入れ)なので、分岐が切り替わっても
  // 再マウントされず、入場はこの画面へ来た一度きりしか流れない
  if (done) {
    // オンボーディングでは庭へ直行せず、理想を書く画面を一度だけ挟む。
    // 宣言(やらないこと)の裏返しを、その勢いのまま書ける場所がここしかない。
    // 書かずに「とばす」でも庭へ抜けられる ── 理想は任意入力のままにしておく。
    const leave = () =>
      onboarding
        ? router.replace({ pathname: '/(app)/ideal', params: { onboarding: '1' } })
        : router.replace('/(app)/(tabs)');
    return (
      <Sumiire style={styles.container}>
        <View style={styles.doneBody}>
          <Text style={styles.doneLede}>{t.declare.doneLede(label)}</Text>
          <Text style={styles.worldview}>{t.declare.doneWorldview}</Text>
          {/* 言い訳カードの告知(言い訳カード §4.4)。世界観の語りの後に一行だけ。
              タップで言い訳カードのタブへ入る。タップ可能であることを示す装飾
              (下線・矢印・ボタン枠)は付けない。告知はこの1箇所のみ。
              オンボーディング中は文言だけ置いて飛ばさない ── ここで抜けると
              理想の画面を通らずに庭へ出てしまう。カードはフッターからいつでも入れる */}
          {onboarding ? (
            <Text style={styles.worldview}>{t.declare.doneExcuseHint}</Text>
          ) : (
            <Pressable onPress={() => router.push('/(app)/(tabs)/excuse')}>
              <Text style={styles.worldview}>{t.declare.doneExcuseHint}</Text>
            </Pressable>
          )}
          <Pressable style={styles.doneAction} onPress={leave}>
            <Text style={styles.doneActionText}>
              {onboarding ? t.declare.next : t.declare.toGarden}
            </Text>
          </Pressable>
        </View>
      </Sumiire>
    );
  }

  if (!packageName) {
    return (
      <Sumiire style={styles.container}>
        <Text style={styles.description}>{t.declare.pickFromObserve}</Text>
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>{t.declare.back}</Text>
        </Pressable>
      </Sumiire>
    );
  }

  // 誓いの状態を確かめとる間は、生成りの地だけを敷いて待つ(宣言と復帰のちらつき防止)
  if (checking) return <Sumiire style={styles.container}><View /></Sumiire>;

  // 復帰モード(§5-3)。基準線は再計算せず、固定された値をそのまま見せる。
  // 挑戦中が3本埋まっとるときは、復帰ボタンの代わりに枠の一文を出す
  // (押してからDBトリガーに断られるより静か。担保はあくまでトリガー側)
  if (graduated) {
    return (
      <Sumiire style={styles.container}>
        <View style={styles.form}>
          <Text style={styles.appLabel}>{label}</Text>
          <Text style={styles.baseline}>
            {t.declare.restoreBaseline(formatMinutes(graduated.baseline_minutes, lang))}
          </Text>
          <Text style={styles.note}>{t.declare.restoreNote}</Text>

          {slotsOpen ? (
            <Pressable style={styles.primary} onPress={restore} disabled={busy}>
              <Text style={styles.primaryText}>{t.declare.restore}</Text>
            </Pressable>
          ) : (
            <Text style={styles.message}>{t.declare.limitReached}</Text>
          )}

          <Pressable style={styles.secondary} onPress={() => router.back()}>
            <Text style={styles.secondaryText}>{t.declare.back}</Text>
          </Pressable>

          {message !== '' && <Text style={styles.message}>{message}</Text>}
        </View>
      </Sumiire>
    );
  }

  // 履歴が28日に満たない間は宣言できない(機種変更直後など)
  if (baseline && baseline.status === 'insufficient') {
    return (
      <Sumiire style={styles.container}>
        <Text style={styles.title}>{t.declare.gatheringTitle}</Text>
        <Text style={styles.description}>
          {t.declare.gatheringBody(BASELINE_MIN_DAYS, baseline.availableDays)}
        </Text>
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>{t.declare.back}</Text>
        </Pressable>
      </Sumiire>
    );
  }

  return (
    <Sumiire style={styles.container}>
      <Text style={styles.title}>{t.declare.title}</Text>

      <View style={styles.form}>
        <Text style={styles.appLabel}>{label}</Text>

        {baseline?.status === 'ok' && (
          <Text style={styles.baseline}>
            {t.declare.baseline(
              Math.round(baseline.windowDays / 7),
              formatMinutes(baseline.averageMinutesPerDay, lang),
            )}
          </Text>
        )}

        <Text style={styles.note}>{t.declare.note}</Text>

        <Pressable
          style={styles.primary}
          onPress={declare}
          disabled={busy || baseline?.status !== 'ok'}
        >
          <Text style={styles.primaryText}>{t.declare.declare}</Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>{t.declare.back}</Text>
        </Pressable>

        {message !== '' && <Text style={styles.message}>{message}</Text>}
      </View>
    </Sumiire>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.kinari,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 20,
    letterSpacing: 4,
    color: colors.sumi,
    textAlign: 'center',
    marginBottom: 40,
  },
  form: { gap: 20 },
  appLabel: {
    fontFamily: fonts.serif,
    fontSize: 17,
    letterSpacing: 2,
    color: colors.sumi,
    textAlign: 'center',
  },
  baseline: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 32,
    letterSpacing: 1,
    color: colors.sumi,
    textAlign: 'center',
  },
  description: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 30,
    letterSpacing: 1,
    color: colors.sumi,
    textAlign: 'center',
  },
  note: {
    fontSize: 12,
    lineHeight: 22,
    color: colors.usuzumi,
    textAlign: 'center',
  },
  primary: {
    marginTop: 28,
    backgroundColor: colors.shu,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    fontFamily: fonts.serif,
    color: colors.kinari,
    fontSize: 16,
    letterSpacing: 6,
  },
  secondary: { paddingVertical: 10, alignItems: 'center' },
  secondaryText: { fontFamily: fonts.serif, fontSize: 13, color: colors.usuzumi, letterSpacing: 3 },
  message: { color: colors.shu, fontSize: 12, textAlign: 'center', marginTop: 8 },

  // 宣言完了画面(§変更5)。世界観の語りと同じ体裁: 明朝・中央寄せ・余白多め
  doneBody: { alignItems: 'center', gap: 40 },
  doneLede: {
    fontFamily: fonts.serif,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.sumi,
    textAlign: 'center',
  },
  worldview: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 34,
    letterSpacing: 2,
    color: colors.sumi,
    textAlign: 'center',
  },
  doneAction: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center' },
  doneActionText: { fontFamily: fonts.serif, fontSize: 15, color: colors.sumi, letterSpacing: 6 },
});
