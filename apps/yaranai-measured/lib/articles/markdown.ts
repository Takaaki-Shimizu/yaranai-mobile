// 記事本文の最小 markdown パーサ(実装仕様書 §5.2)。
// 見出しは h2 まで。外部ライブラリは入れず、記事に必要な部分集合だけを扱う。
//
// 対応:
//   - `## ` で始まる行 → h2 見出しブロック(1行)
//   - それ以外は空行で区切られた段落ブロック。段落内の単一改行は行送りとして残す。
// 非対応(記事本文では使わない): h1/h3 以降・リスト・強調・リンク・コード等。

export type ArticleBlock =
  | { type: 'h2'; text: string }
  | { type: 'p'; text: string };

// 本文 markdown をレンダリング用のブロック列へ。純関数。
export function parseArticleBody(body: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  // 改行コードを LF に正規化してから空行で段落分割する。
  const normalized = body.replace(/\r\n?/g, '\n');
  const chunks = normalized.split(/\n{2,}/);

  for (const rawChunk of chunks) {
    const chunk = rawChunk.replace(/^\n+|\n+$/g, '');
    if (chunk.trim() === '') continue;

    // 見出しは1ブロック=1行を前提にする(本文の見出しは h2 まで・単行)。
    if (chunk.startsWith('## ')) {
      blocks.push({ type: 'h2', text: chunk.slice(3).trim() });
      continue;
    }
    blocks.push({ type: 'p', text: chunk });
  }

  return blocks;
}
