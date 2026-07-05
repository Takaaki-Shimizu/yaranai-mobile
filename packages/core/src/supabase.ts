import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as aesjs from "aes-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

// SecureStoreは2048バイトまでの制限があるけん、
// AES-256キーだけSecureStoreに置いて、暗号化された本体はAsyncStorageに保存する
class LargeSecureStore {
  private async _encrypt(key: string, value: string) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    const cipher = new aesjs.ModeOfOperation.ctr(
      encryptionKey,
      new aesjs.Counter(1),
    );
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(
      key,
      aesjs.utils.hex.fromBytes(encryptionKey),
    );
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async _decrypt(key: string, value: string) {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) {
      return encryptionKeyHex;
    }
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) {
      return encrypted;
    }
    return await this._decrypt(key, encrypted);
  }

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key: string, value: string) {
    const encrypted = await this._encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}

// URL/キーは各アプリが自分の環境変数を渡す。
// 未設定のままビルドされた場合は throw せず null を返し、
// 起動クラッシュではなくアプリ側の設定エラー画面に委ねる。
export function createYaranaiClient(
  supabaseUrl: string | undefined,
  supabasePublishableKey: string | undefined,
) {
  if (!supabaseUrl || !supabasePublishableKey) {
    return null;
  }

  // Webのサーバーサイドレンダリング(Node)では window が無く、
  // AsyncStorage/SecureStore/crypto も使えんけん、ストレージを無効にする
  const isWeb = Platform.OS === "web";
  const isServer = isWeb && typeof window === "undefined";

  // - ネイティブ: SecureStore + AsyncStore で暗号化保存
  // - Webブラウザ: AsyncStorage(localStorage)
  // - Web SSR: ストレージ無し + セッション永続化を無効
  const authStorage = isServer
    ? undefined
    : isWeb
      ? AsyncStorage
      : new LargeSecureStore();

  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      storage: authStorage,
      autoRefreshToken: !isServer,
      persistSession: !isServer,
      // Webブラウザだけ、リセット/確認メールのリンク(URLハッシュ)から
      // セッションを復元する。ネイティブ/SSRでは無効。
      detectSessionInUrl: isWeb && !isServer,
    },
  });
}

// リセットメールのリンク(ネイティブのディープリンク)から
// access_token / refresh_token を取り出すためのヘルパー。
// Webは detectSessionInUrl が自動でやってくれるけん、主にネイティブ用。
export function parseAuthTokensFromUrl(url: string) {
  const fragment = url.includes("#")
    ? url.split("#")[1]
    : (url.split("?")[1] ?? "");
  const params = new URLSearchParams(fragment);
  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    type: params.get("type"),
  };
}
