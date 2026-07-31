// 誓い別詳細のスナップショットキャッシュ。
//
// 詳細画面の数字はサーバー(measured_daily)を唯一の計算ソースとし、端末には
// 「最後に取得できた結果の写し」だけを持つ。オフライン時はこの写しをそのまま
// 表示する(端末DBから計算し直さない)。別ソースで再計算すると、ホームの累計
// (measured_saved ビュー)との検算がズレる経路が残るため。古いことはあっても
// ズレることはない、に倒す。

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VowLogEntry } from './vow-log';

export type VowLogSnapshot = {
  vow: {
    package_name: string;
    app_label: string;
    baseline_minutes: number;
    declared_on: string;
  };
  entries: VowLogEntry[];
};

const keyFor = (vowId: string) => `vow-log-snapshot:v1:${vowId}`;

/** 最後にサーバーから取得できたログ(なければ null=未取得) */
export async function loadVowLogSnapshot(vowId: string): Promise<VowLogSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(vowId));
    return raw ? (JSON.parse(raw) as VowLogSnapshot) : null;
  } catch {
    return null;
  }
}

/** サーバー取得成功のたびに写しを更新する */
export async function saveVowLogSnapshot(vowId: string, snapshot: VowLogSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(vowId), JSON.stringify(snapshot));
  } catch {
    // 保存失敗は無視(次のオフライン時に写しが古いだけ)
  }
}
