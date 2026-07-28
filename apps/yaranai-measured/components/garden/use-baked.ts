// 庭の絵は「オフスクリーンに一度描いて画像に焼く」方式(renderer.ts)。焼いた画像は
// Canvas に置くだけなので演出もパンも軽いが、次の二つに弱い:
//
//  1. バックグラウンド復帰。描画面が作り直されたあと Skia が描き直さんかったとき、
//     庭だけが空のまま残る(体感で数回に1回)。
//  2. ベイクの失敗。描画面が整っとらん間は Skia.Surface.MakeOffscreen が null を
//     返すことがあり、bake* は null になる。今までは何も描かず空のままやった。
//
// この hook が両方をまとめて面倒をみる:
//  - 復帰のたびに焼き直す(呼び元は generation を Canvas の key に渡して面ごと作り直す)
//  - 焼けんかったときは短い間隔で数回やり直す
//  - やり直しの間も直前に焼けた絵を出し続ける(空にはせん)

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForegroundGeneration } from '../../lib/use-foreground';

/** ベイクに失敗したときのやり直し回数と間隔 */
const RETRIES = 5;
const RETRY_MS = 150;

export type Baked<T> = {
  /** 焼けた絵。やり直し中は直前に焼けた絵。一度も焼けとらんときだけ null */
  value: T | null;
  /** バックグラウンド復帰の世代。Canvas の key に渡して描画面ごと作り直す */
  generation: number;
};

/**
 * bake は「焼けたら値、焼けんかったら null」を返す関数。deps は useMemo と同じ意味で、
 * 復帰の世代とやり直しの回数はこの hook が自動で足す。
 * bake には復帰の世代を渡す(0 = 起動してから一度も復帰しとらん)。復帰後にしか
 * 要らん手間を省くために使える。
 */
export function useBaked<T>(
  bake: (generation: number) => T | null,
  deps: readonly unknown[],
): Baked<T> {
  const generation = useForegroundGeneration();
  const [attempt, setAttempt] = useState(0);
  const lastGood = useRef<T | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fresh = useMemo(() => bake(generation), [...deps, generation, attempt]);
  if (fresh !== null) lastGood.current = fresh;

  // 焼けんかった間だけ、短い間隔で数回やり直す
  useEffect(() => {
    if (fresh !== null || attempt >= RETRIES) return;
    const timer = setTimeout(() => setAttempt((a) => a + 1), RETRY_MS);
    return () => clearTimeout(timer);
  }, [fresh, attempt]);

  // 復帰したら、やり直しの回数を仕切り直す
  useEffect(() => {
    setAttempt(0);
  }, [generation]);

  return { value: fresh ?? lastGood.current, generation };
}
