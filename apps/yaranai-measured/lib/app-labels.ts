// パッケージ名から表示名を引く。優先順は
//   1. 端末に登録された正式なアプリ名(PackageManager。「みてね」「X」など)
//   2. JS側の対応表(ネイティブが引けん場合の備え)
//   3. パッケージ名からの整形(最後の手段。App54F7C05C のような名前も出る)
// 1 の取得は modules/usage-stats の getAppLabels、ここは受け取った表を使うだけ。
// この関数は純粋なまま保ち、ネイティブ呼び出しは画面側に置く。

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

export function labelForPackage(
  packageName: string,
  officialLabels?: Record<string, string>,
): string {
  const official = officialLabels?.[packageName]?.trim();
  if (official) return official;
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
