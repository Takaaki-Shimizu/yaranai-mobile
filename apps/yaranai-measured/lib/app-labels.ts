// パッケージ名から表示名を引く。ネイティブの公開APIを3つに保つため、
// PackageManagerには問い合わせず、JS側の対応表と整形で済ませる。

const KNOWN_LABELS: Record<string, string> = {
  'com.google.android.youtube': 'YouTube',
  'com.google.android.apps.youtube.music': 'YouTube Music',
  'com.instagram.android': 'Instagram',
  'com.twitter.android': 'X',
  'com.zhiliaoapp.musically': 'TikTok',
  'com.ss.android.ugc.trill': 'TikTok',
  'jp.naver.line.android': 'LINE',
  'com.facebook.katana': 'Facebook',
  'com.reddit.frontpage': 'Reddit',
  'com.netflix.mediaclient': 'Netflix',
  'tv.abema': 'ABEMA',
  'com.amazon.avod.thirdpartyclient': 'Prime Video',
  'com.amazon.mShop.android.shopping': 'Amazon',
  'com.spotify.music': 'Spotify',
  'com.discord': 'Discord',
  'org.telegram.messenger': 'Telegram',
  'com.whatsapp': 'WhatsApp',
  'com.pinterest': 'Pinterest',
  'com.android.chrome': 'Chrome',
  'com.google.android.gm': 'Gmail',
  'com.google.android.apps.maps': 'Google マップ',
};

const GENERIC_SEGMENTS = new Set([
  'android', 'app', 'apps', 'mobile', 'client', 'free', 'jp', 'com',
]);

export function labelForPackage(packageName: string): string {
  const known = KNOWN_LABELS[packageName];
  if (known) return known;
  const segments = packageName
    .split('.')
    .filter((s) => !GENERIC_SEGMENTS.has(s.toLowerCase()));
  const last = segments.length > 0 ? segments[segments.length - 1] : packageName;
  return last.charAt(0).toUpperCase() + last.slice(1);
}

// 観測一覧から外す「アプリと呼べない」もの。ランチャー・システムUI・
// 入力メソッド・自分自身。観測は無制限が原則やけん、最小限に留める。
const NOISE_PACKAGES = new Set([
  'app.yaranai.measured',
  'com.android.systemui',
  'com.android.settings',
  'com.google.android.apps.nexuslauncher',
  'com.sec.android.app.launcher',
]);

export function isNoisePackage(packageName: string): boolean {
  if (NOISE_PACKAGES.has(packageName)) return true;
  if (packageName.includes('launcher')) return true;
  if (packageName.includes('inputmethod')) return true;
  return false;
}
