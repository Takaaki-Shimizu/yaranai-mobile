// 記事1「このアプリが、あなたにしないこと」の英語版本文。
//
// 日本語版(shinai-koto.ts)が正本。これは逐語訳ではなく、英語話者が読んで
// 違和感のない自然な文章として書き直した翻案。トーンの方針(記事2英語版と同じ):
//   - 静かな断定・短い文・数字を出さない、という日本語版の呼吸を保つ。
//   - スラングは使わない。約束は「We won't …」の反復で束ね、宣言文の静けさを崩さない。
//   - 見出し・段落構成は日本語版と1対1で対応させる(markdown.ts の範囲: h2 と段落)。
//   - 庭の固有名詞は日本語版同様、最終節の garden / veranda(縁側)のみ。
//
// 差し替え時も日本語版と同様、id('shinai-koto') は不変(既読状態の永続キー)。
export const SHINAI_KOTO_BODY_EN = `Whether this is your first day here or your hundredth, we'll tell you the same thing.

Before anything begins, knowing what won't happen probably matters more than knowing what will — it makes it easier to start at ease. So first, let us talk about the things this app will not do.

## We won't rush you

No notification will call you back here. No counter will tally your days in a row and warn you that your streak is about to break.

On a day you don't open this app, nothing happens. Nothing scolds you, and nothing is lost. On days you don't feel like opening it, don't.

## We won't take anything away

We don't lock your apps, and we don't force them shut.

Time protected by confiscation returns to old habits the moment it's handed back. If you've tried to quit before, and slid back every time, that wasn't weakness of will. Mechanisms that hold you down from the outside are built so that their effect vanishes the instant the holding stops. We don't use that method here.

## We won't ask for zero

Not using your phone at all is not the goal.

You used it less than usual — that's enough. Half as much, or just a little less: if it's shorter than usual, that difference comes back to you as your own time. Nothing here is judged all-or-nothing, so there's never a reason to quit halfway.

## We won't grade what you do with the time

This app never asks what you did with the time that came back.

It doesn't have to be reading or study. You can end the day having done nothing in particular. You can sleep. Time spent just gazing out the window is still time you took back — that doesn't change.

"It only counts if I spend it well" — the moment you think that, it becomes new homework. This is not an app for adding homework.

## The one thing you do

We've listed what we won't do. What you do is a single thing.

Watch. Watch what you were handing your time to, and how much of it. If you watch the garden come into order the way you'd watch it from the veranda, you should feel your own mind coming into order with it.

## When in doubt

When in doubt, remember only what's written here. No rushing, no taking away, no demanding zero, no grading.

Those four are ours to keep. The rest can go at your pace.
`;
