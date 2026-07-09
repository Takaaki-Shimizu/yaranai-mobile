// 開発者モードの庭デバッグUI(§2)。
// 日数と累計取り戻し時間の2軸を手動注入し、庭をリアルタイムに再描画する。
// UsageStatsManager は一切触らず、Supabase も高水位も差分演出も通さない。
// データソースはこの画面のスライダー/数値入力だけ。
//
// 石は Day1 完成・育たない要素なので固定 3(切り替えUIなし)。
// 苔スライダーの上限はハードコードせず MOSS_FULL_HOURS を import して使う
// (満開=1.0 に一致させ、基準変更に自動追従させるため)。

import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { colors, fonts } from '@yaranai/core';

import { HomeGarden } from './HomeGarden';
import { buildGrowthFromDebug } from './load';
import { HOME_ASPECT } from '../../lib/garden/scene';
import { FULL_DAYS, MOSS_FULL_HOURS } from '../../lib/garden/growth';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
};

// 数値直接入力 + ドラッグスライダーの両対応(§2)。
function DebugSlider({ label, value, min, max, step, unit, onChange }: SliderProps) {
  const [trackW, setTrackW] = useState(0);
  const [text, setText] = useState(String(value));

  const snap = (raw: number) => clamp(Math.round(raw / step) * step, min, max);

  const setFromX = (x: number) => {
    if (trackW <= 0) return;
    const v = snap(min + (x / trackW) * (max - min));
    setText(String(v));
    onChange(v);
  };

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin((e) => {
          'worklet';
          runOnJS(setFromX)(e.x);
        })
        .onUpdate((e) => {
          'worklet';
          runOnJS(setFromX)(e.x);
        }),
    // setFromX は trackW/min/max/step/onChange に依存する。これらが変わったら作り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trackW, min, max, step, onChange],
  );

  const commitText = () => {
    const parsed = Number(text);
    if (Number.isFinite(parsed)) {
      const v = snap(parsed);
      setText(String(v));
      onChange(v);
    } else {
      setText(String(value)); // 不正入力は元に戻す
    }
  };

  const frac = max > min ? (value - min) / (max - min) : 0;

  return (
    <View style={styles.control}>
      <View style={styles.controlHead}>
        <Text style={styles.controlLabel}>{label}</Text>
        <View style={styles.numberBox}>
          <TextInput
            style={styles.number}
            value={text}
            onChangeText={setText}
            onBlur={commitText}
            onSubmitEditing={commitText}
            keyboardType="numeric"
            returnKeyType="done"
            selectTextOnFocus
          />
          <Text style={styles.unit}>{unit}</Text>
        </View>
      </View>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.track}
          onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        >
          <View style={styles.base} />
          <View style={[styles.fill, { width: `${frac * 100}%` }]} />
          <View style={[styles.thumb, { left: `${frac * 100}%` }]} />
        </View>
      </GestureDetector>
    </View>
  );
}

export function DevGarden() {
  const { width } = useWindowDimensions();
  const [days, setDays] = useState(42);
  const [savedHours, setSavedHours] = useState(Math.round(MOSS_FULL_HOURS / 2));

  const growth = useMemo(() => buildGrowthFromDebug(days, savedHours), [days, savedHours]);
  const gardenHeight = Math.round(width / HOME_ASPECT);

  return (
    <View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>開発者モード · 実測は取得しません</Text>
      </View>

      {/* 現在のスライダー値に対応する一枚だけを描く(差分演出なし: prevGrowth 未指定) */}
      <HomeGarden growth={growth} height={gardenHeight} />

      <View style={styles.panel}>
        <DebugSlider
          label="記録日数"
          value={days}
          min={0}
          max={FULL_DAYS}
          step={1}
          unit="日"
          onChange={setDays}
        />
        <DebugSlider
          label="累計取り戻し時間"
          value={savedHours}
          min={0}
          max={MOSS_FULL_HOURS}
          step={1}
          unit="時間"
          onChange={setSavedHours}
        />
        <Text style={styles.note}>
          石は固定 3。苔は {MOSS_FULL_HOURS} 時間で満開(1.0)。
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'center',
    marginBottom: 12,
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.usuzumi,
    borderStyle: 'dashed',
    borderRadius: 2,
  },
  badgeText: { fontSize: 11, letterSpacing: 2, color: colors.usuzumi },

  panel: { paddingHorizontal: 28, paddingTop: 32, gap: 28 },
  control: { gap: 12 },
  controlHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlLabel: { fontFamily: fonts.serif, fontSize: 15, letterSpacing: 2, color: colors.sumi },
  numberBox: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  number: {
    minWidth: 56,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: colors.usuzumi,
    fontFamily: fonts.serif,
    fontSize: 18,
    color: colors.sumi,
    textAlign: 'right',
  },
  unit: { fontSize: 12, color: colors.usuzumi, letterSpacing: 1 },

  track: {
    height: 28,
    justifyContent: 'center',
  },
  base: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.usuzumi,
    opacity: 0.35,
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: 2,
    backgroundColor: colors.sumi,
  },
  thumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    marginLeft: -11,
    borderRadius: 11,
    backgroundColor: colors.kinari,
    borderWidth: 1.5,
    borderColor: colors.sumi,
  },
  note: { fontSize: 12, color: colors.usuzumi, letterSpacing: 1, lineHeight: 20 },
});
