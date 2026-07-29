// Android 11+ のパッケージ可視性(package visibility)対応。
//
// X(旧Twitter)公式アプリが端末に入っているかを isPackageInstalled で確かめ、
// 共有インテントの宛先に直接指定するには、AndroidManifest に
// <queries><package android:name="com.twitter.android"/></queries> が要る。
// これが無いと Android 11 以降では「入っていても見えない」ため、
// Xボタンが常に共有シートへ降りてしまう。
//
// app.json の plugins から読まれる。prebuild(expo run:android)のたびに効く。
const { withAndroidManifest } = require('@expo/config-plugins');

const X_PACKAGE = 'com.twitter.android';

module.exports = function withXQueries(config) {
  return withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;
    if (!Array.isArray(manifest.queries) || manifest.queries.length === 0) {
      manifest.queries = [{}];
    }
    const queries = manifest.queries[0];
    if (!Array.isArray(queries.package)) queries.package = [];
    if (!queries.package.some((p) => p.$?.['android:name'] === X_PACKAGE)) {
      queries.package.push({ $: { 'android:name': X_PACKAGE } });
    }
    return c;
  });
};
