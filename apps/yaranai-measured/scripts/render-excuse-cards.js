#!/usr/bin/env node
// 言い訳カードのSVGを書き出す開発用スクリプト。
//   npx tsc -p tsconfig.test.json && node scripts/render-excuse-cards.js <outDir>
//
// 出すのは3つ:
//   mock   … モック v3 の顔(確定例文)。版下がモックとずれとらんかの照合用
//   longest… 全角14字×2行の最長ケース(§9-2 のはみ出し確認)
//   single … 読点なしの1行(ベースラインが2行の中間に来るか)

const fs = require('node:fs');
const path = require('node:path');

const dist = path.join(__dirname, '..', '.test-dist');
const { cardToSvg } = require(path.join(dist, 'excuse', 'preview-svg.js'));
const { splitExcuseLines } = require(path.join(dist, 'excuse', 'validate.js'));
const { formatDeclaredOn } = require(path.join(dist, 'excuse', 'format.js'));
const { EXCUSE_CARD_URL } = require(path.join(dist, 'excuse', 'url.js'));

const outDir = process.argv[2] || path.join(__dirname, '..', '.excuse-previews');
fs.mkdirSync(outDir, { recursive: true });

const CUSTODY = {
  square: ['この宣言は、Yaranaiがお預かりしています。'],
  story: ['この宣言は、Yaranaiが', 'お預かりしています。'],
};

const cases = {
  mock: 'ショート動画があるアプリは、やらない。',
  longest: `${'あ'.repeat(13)}、${'い'.repeat(13)}`, // 14字×2行(上限を超える最長ケース)
  single: '二次会はやらない。',
};

for (const [name, text] of Object.entries(cases)) {
  for (const size of ['square', 'story']) {
    const svg = cardToSvg(size, {
      lines: splitExcuseLines(text),
      date: formatDeclaredOn('2026-07-29', 'ja'),
      custody: CUSTODY[size],
      wordmark: 'Y a r a n a i',
      qrLabel: 'Yaranaiとは',
      url: EXCUSE_CARD_URL,
    });
    fs.writeFileSync(path.join(outDir, `${name}-${size}.svg`), svg);
  }
}

console.log(`wrote ${Object.keys(cases).length * 2} svg to ${outDir}`);
