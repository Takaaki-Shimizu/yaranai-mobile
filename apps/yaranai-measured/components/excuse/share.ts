// カードの書き出しと共有(指示書 §4.3)。
//
// 書き出しは2サイズ(§2-8): 正方形 1080×1080(LINE・投稿)と 9:16 1080×1920
// (ストーリーズ・対面提示)。PNGを端末のキャッシュへ置き、Android標準の共有シートへ渡す。
//
// Xへのポストだけは共有シートを介さない専用の道を持つ(postCardToX)。
// X公式アプリの投稿画面を、正方形カードを添えて直接開く ── 認証はX側アプリの
// ものをそのまま使い、こちらはAPIキーもログインも持たない。
// Xが入っていない・渡せない端末では通常の共有シートへ降りる。
//
// 煽りは足さない(§8)。共有の記録はサイズ種別だけを残し、共有先アプリ名は取得しない。
// Xボタンは宛先が行為そのものに含まれるが、記録は他と同じくサイズ種別にとどめる(§6)。

import { ImageFormat, type SkImage } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { CardSize } from '../../lib/excuse/card-spec';
import { logCardShared } from '../../lib/excuse/storage';
import { bakeCardImage, type CardContent } from './bake';

export type ShareResult = 'shared' | 'unavailable' | 'failed';

const X_PACKAGE = 'com.twitter.android';

// react-native-share はネイティブモジュール。JSだけがOTAで先に届き、ネイティブが
// 古いビルドのままの端末で画面ごと落とさないよう、読み込みは遅延させて失敗を拾う
type ShareModule = {
  default: {
    isPackageInstalled(pkg: string): Promise<{ isInstalled: boolean }>;
    shareSingle(options: { social: string; url: string; type?: string }): Promise<unknown>;
  };
  Social: { Twitter: string };
};

async function loadShareModule(): Promise<ShareModule | null> {
  try {
    return (await import('react-native-share')) as unknown as ShareModule;
  } catch (e) {
    console.warn('[excuse] react-native-share unavailable:', e);
    return null;
  }
}

/** カードをPNGに焼く。失敗は null(呼び出し側が静かな一文に変える) */
function bakePng(size: CardSize, content: CardContent): SkImage | null {
  try {
    return bakeCardImage(size, content);
  } catch (e) {
    console.warn('[excuse] bake failed:', e);
    return null;
  }
}

function encodeBytes(image: SkImage): Uint8Array | null {
  try {
    const bytes = image.encodeToBytes(ImageFormat.PNG);
    return bytes && bytes.length > 0 ? bytes : null;
  } catch (e) {
    console.warn('[excuse] png encode failed:', e);
    return null;
  }
}

/** PNGをキャッシュへ書いて共有シートを開く */
async function openShareSheet(size: CardSize, bytes: Uint8Array): Promise<ShareResult> {
  try {
    if (!(await Sharing.isAvailableAsync())) return 'unavailable';
    // 同じ名前へ上書きし続ける。カードは1人1枚なので、書き出しの履歴は端末に残さない
    const file = new File(Paths.cache, `yaranai-excuse-${size}.png`);
    file.create({ overwrite: true });
    file.write(bytes);
    await Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png' });
  } catch (e) {
    console.warn('[excuse] share sheet failed:', e);
    return 'failed';
  }
  return 'shared';
}

/**
 * カードをPNGに焼いて共有シートを開く。
 * 'unavailable' は共有機構そのものが無い端末(共有シートを持たない環境)。
 * どの経路で失敗しても必ず結果を返す ── 例外を漏らして画面を黙らせない。
 */
export async function shareCard(
  userId: string,
  size: CardSize,
  content: CardContent,
): Promise<ShareResult> {
  const image = bakePng(size, content);
  if (!image) return 'failed';
  const bytes = encodeBytes(image);
  image.dispose();
  if (!bytes) return 'failed';

  const result = await openShareSheet(size, bytes);
  if (result !== 'shared') return result;

  // 共有シートを開けたところまでを記録する。Androidの共有シートは、
  // 送り先で送ったのか畳んだのかを返さない ── 取れない差は取りに行かない。
  // 記録するのはサイズ種別だけで、共有先アプリ名は取得しない(§6)
  logCardShared(userId, size);
  return 'shared';
}

/**
 * 正方形カードを添えてXの投稿画面を直接開く(§4.3 の投稿向きサイズ)。
 * 最後の「ポスト」はX側で押してもらう ── これはXの仕様で、こちらでは省けない。
 * Xが入っていない・直接渡せないときは通常の共有シートへ降りる。
 */
export async function postCardToX(
  userId: string,
  content: CardContent,
): Promise<ShareResult> {
  const size: CardSize = 'square';
  const image = bakePng(size, content);
  if (!image) return 'failed';

  // Xへは base64 のデータURIで渡し(react-native-share が自前のFileProviderで配る)、
  // 共有シートへ降りるときは既存の道と同じくバイト列をキャッシュに書く
  let base64: string | null = null;
  try {
    base64 = image.encodeToBase64(ImageFormat.PNG);
  } catch (e) {
    console.warn('[excuse] png base64 encode failed:', e);
  }
  const bytes = encodeBytes(image);
  image.dispose();

  const mod = await loadShareModule();
  if (mod && base64) {
    try {
      const { isInstalled } = await mod.default.isPackageInstalled(X_PACKAGE);
      if (isInstalled) {
        await mod.default.shareSingle({
          social: mod.Social.Twitter,
          url: `data:image/png;base64,${base64}`,
          type: 'image/png',
        });
        logCardShared(userId, size);
        return 'shared';
      }
    } catch (e) {
      // Xが見えない・投稿画面へ渡せない端末。共有シートへ降りる
      console.warn('[excuse] post to X failed, falling back to sheet:', e);
    }
  }

  if (!bytes) return 'failed';
  const result = await openShareSheet(size, bytes);
  if (result === 'shared') logCardShared(userId, size);
  return result;
}
