// 理想(WHAT)の永続化層。AsyncStorage に端末ローカルで持つ(記事状態と同じローカルファースト)。
//
// 記事状態と違い user_id でキーを分ける。理想は「なぜ時間を取り戻すのか」という個人の言葉で、
// 共用端末で前ユーザーのものが庭の直上に出続けるのは避けたいため。
// ログアウトでは消さない(再ログインで無傷に戻る)。

import AsyncStorage from '@react-native-async-storage/async-storage';

const keyFor = (userId: string) => `yaranai.ideal.v1:${userId}`;

/** 保存されている理想。未入力・読み取り失敗はどちらも空文字(正常系) */
export async function loadIdeal(userId: string): Promise<string> {
  try {
    return (await AsyncStorage.getItem(keyFor(userId))) ?? '';
  } catch {
    return '';
  }
}

/** 理想を保存する。空文字は削除として扱う。書けたかどうかを返す */
export async function saveIdeal(userId: string, text: string): Promise<boolean> {
  try {
    if (text === '') await AsyncStorage.removeItem(keyFor(userId));
    else await AsyncStorage.setItem(keyFor(userId), text);
    return true;
  } catch {
    return false;
  }
}
