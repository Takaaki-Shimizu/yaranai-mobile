// カードに載せるQRのモジュール行列。描画系には依存しない(Skiaでも節点の検査でも同じ物を使う)。
//
// 誤り訂正は Q(25%)。カードのURL(43バイト)は L で 29 モジュール、Q でも 33 モジュールに
// しかならず、1段の拡大で訂正能力が 7% → 25% に上がる。カードは相手の画面越しや斜めから
// 読まれる前提なので、同じ寸法で強いほうを採る(§9-3)。
//
// 自前実装は持たない。読み取り可否が受け入れ基準に入っている以上、
// 実績のある実装(qrcode-generator, MIT)に委ねるほうが確実なため。

import qrcode from 'qrcode-generator';

export const QR_ERROR_CORRECTION = 'Q';

/**
 * text を符号化したモジュール行列(true=墨)。静穏帯は含まない ──
 * 生成り面の内側余白(CardLayout.qr.quietModules)がそれを兼ねる。
 */
export function buildQrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, QR_ERROR_CORRECTION);
  // Byte モード固定。URLはASCIIなので既定の変換で足りる
  qr.addData(text, 'Byte');
  qr.make();
  const count = qr.getModuleCount();
  const matrix: boolean[][] = [];
  for (let row = 0; row < count; row += 1) {
    const line: boolean[] = [];
    for (let col = 0; col < count; col += 1) line.push(qr.isDark(row, col));
    matrix.push(line);
  }
  return matrix;
}
