// カードの書き出しと共有(指示書 §4.3)。
//
// 書き出しは2サイズ(§2-8): 正方形 1080×1080(LINE・投稿)と 9:16 1080×1920
// (ストーリーズ・対面提示)。PNGを端末のキャッシュへ置き、Android標準の共有シートへ渡す。
//
// 煽りは足さない(§8)。共有の記録はサイズ種別だけを残し、共有先アプリ名は取得しない。

import { ImageFormat } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { CardSize } from '../../lib/excuse/card-spec';
import { logCardShared } from '../../lib/excuse/storage';
import { bakeCardImage, type CardContent } from './bake';

export type ShareResult = 'shared' | 'unavailable' | 'failed';

/**
 * カードをPNGに焼いて共有シートを開く。
 * 'unavailable' は共有機構そのものが無い端末(共有シートを持たない環境)。
 */
export async function shareCard(
  userId: string,
  size: CardSize,
  content: CardContent,
): Promise<ShareResult> {
  const image = bakeCardImage(size, content);
  if (!image) return 'failed';

  let bytes: Uint8Array | null = null;
  try {
    bytes = image.encodeToBytes(ImageFormat.PNG);
  } catch {
    return 'failed';
  } finally {
    image.dispose();
  }
  if (!bytes || bytes.length === 0) return 'failed';

  try {
    if (!(await Sharing.isAvailableAsync())) return 'unavailable';
    // 同じ名前へ上書きし続ける。カードは1人1枚なので、書き出しの履歴は端末に残さない
    const file = new File(Paths.cache, `yaranai-excuse-${size}.png`);
    file.create({ overwrite: true });
    file.write(bytes);
    await Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png' });
  } catch {
    return 'failed';
  }

  // 共有シートを開けたところまでを記録する。Androidの共有シートは、
  // 送り先で送ったのか畳んだのかを返さない ── 取れない差は取りに行かない。
  // 記録するのはサイズ種別だけで、共有先アプリ名は取得しない(§6)
  logCardShared(userId, size);
  return 'shared';
}
