// Android 11+ のパッケージ可視性(package visibility)対応。
//
// お問い合わせ導線(設定+お問い合わせ スペック §4.4)は、開く前に
// Linking.canOpenURL('mailto:...') でメールアプリの有無を確かめ、
// 無ければアドレスをコピーできるフォールバックへ倒す。
// AndroidManifest に mailto の <queries><intent> が無いと、Android 11 以降では
// メールアプリが入っていても canOpenURL が常に false を返し、
// 全員がフォールバックへ落ちてしまう。
//
// app.json の plugins から読まれる。prebuild(expo run:android)のたびに効く。
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withMailtoQueries(config) {
  return withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;
    if (!Array.isArray(manifest.queries) || manifest.queries.length === 0) {
      manifest.queries = [{}];
    }
    const queries = manifest.queries[0];
    if (!Array.isArray(queries.intent)) queries.intent = [];
    const hasMailto = queries.intent.some((i) =>
      (i.data ?? []).some((d) => d.$?.['android:scheme'] === 'mailto'),
    );
    if (!hasMailto) {
      queries.intent.push({
        action: [{ $: { 'android:name': 'android.intent.action.SENDTO' } }],
        data: [{ $: { 'android:scheme': 'mailto' } }],
      });
    }
    return c;
  });
};
