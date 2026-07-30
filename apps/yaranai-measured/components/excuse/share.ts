// カードの書き出しと共有(指示書 §4.3)。
//
// 書き出しは2サイズ(§2-8): 正方形 1080×1080(LINE・投稿)と 9:16 1080×1920
// (ストーリーズ・対面提示)。PNGを端末のキャッシュへ置き、Android標準の共有シートへ渡す。
// 宛先ごとの専用経路は持たない ── 送り先を選ぶのは共有シートの仕事で、こちらは奪わない。
//
// 煽りは足さない(§8)。共有の記録はサイズ種別だけを残し、共有先アプリ名は取得しない(§6)。

import { ImageFormat, type SkImage } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { CardSize } from '../../lib/excuse/card-spec';
import { logCardShared } from '../../lib/excuse/storage';
import { withExternalUi } from '../../lib/external-ui';
import { bakeCardImage, type CardContent } from './bake';

export type ShareResult = 'shared' | 'unavailable' | 'failed';

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
    // シートを開いとる間は「アプリ内から開いた OS の画面」の印を立てる。共有せずに
    // 戻ったときに起動演出の静止画を挟まんため(lib/external-ui.ts)
    await withExternalUi(() =>
      Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png' }),
    );
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
