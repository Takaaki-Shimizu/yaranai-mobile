#!/usr/bin/env node
// 言い訳カードのSVGを書き出す開発用スクリプト。
//   npx tsc -p tsconfig.test.json && node scripts/render-excuse-cards.js <outDir>
//
// 出すのは3つ:
//   mock   … モック v3 の顔(確定例文)。版下がモックとずれとらんかの照合用
//   longest… 入力上限(全角20字)いっぱいの最長ケース(§9-2 のはみ出し確認)
//   single … 1行に収まる短い宣言(ベースラインが2行の中間に来るか)

const fs = require('node:fs');
const path = require('node:path');

const dist = path.join(__dirname, '..', '.test-dist');
const { cardToSvg } = require(path.join(dist, 'excuse', 'preview-svg.js'));
const { excuseLines, EXCUSE_MAX_WIDTH } = require(path.join(dist, 'excuse', 'validate.js'));
const { formatDeclaredOn } = require(path.join(dist, 'excuse', 'format.js'));
const { EXCUSE_CARD_URL } = require(path.join(dist, 'excuse', 'url.js'));

const outDir = process.argv[2] || path.join(__dirname, '..', '.excuse-previews');
fs.mkdirSync(outDir, { recursive: true });

const CUSTODY = {
  square: ['この宣言は、Yaranaiがお預かりしています。'],
  story: ['この宣言は、Yaranaiが', 'お預かりしています。'],
};

const cases = {
  mock: 'ショート動画があるアプリ',
  longest: 'あ'.repeat(EXCUSE_MAX_WIDTH), // 入力上限いっぱい(1行目が全角21字。安全幅へ縮む)
  single: '二次会',
};

for (const [name, text] of Object.entries(cases)) {
  for (const size of ['square', 'story']) {
    const svg = cardToSvg(size, {
      lines: excuseLines(text, 'ja'),
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
