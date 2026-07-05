import { createYaranaiClient } from "@yaranai/core";

export { parseAuthTokensFromUrl } from "@yaranai/core";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// 未設定だった環境変数名。_layout がこれを見て設定エラー画面を出す
export const missingEnvVars = [
  !supabaseUrl ? "EXPO_PUBLIC_SUPABASE_URL" : null,
  !supabasePublishableKey ? "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY" : null,
].filter((name): name is string => name !== null);

// 実測版は申告版とは別のSupabaseプロジェクトを使う。
// 同期されるのは「誓い対象アプリの日次実測合計」と「基準線」だけ。
// 全アプリの利用ログは端末内DB(expo-sqlite)から外に出さない。
const client = createYaranaiClient(supabaseUrl, supabasePublishableKey);

// missingEnvVars が空なら client は必ず non-null。
// 欠けている場合は _layout が設定エラー画面で止めて以降の画面を描画しないため、
// 呼び出し側では non-null として扱ってよい。
export const supabase = client as NonNullable<typeof client>;
