import { createYaranaiClient } from "@yaranai/core";

export { parseAuthTokensFromUrl } from "@yaranai/core";

export const supabase = createYaranaiClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);
