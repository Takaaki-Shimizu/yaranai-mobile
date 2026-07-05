import { createYaranaiClient } from "@yaranai/core";

export { parseAuthTokensFromUrl } from "@yaranai/core";

// 実測版は申告版とは別のSupabaseプロジェクトを使う。
// 同期されるのは「誓い対象アプリの日次実測合計」と「基準線」だけ。
// 全アプリの利用ログは端末内DB(expo-sqlite)から外に出さない。
export const supabase = createYaranaiClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);
