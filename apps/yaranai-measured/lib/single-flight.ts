// 同じ非同期の仕事を二重に走らせず、進行中の1本に相乗りさせるくくり。
//
// 端末内DBへの書き込み同期(syncLocalUsage)が要る理由: expo-sqlite の
// withExclusiveTransactionAsync は排他トランザクションを別コネクションで走らせ、
// 並走する他の書き込みは待たされずに「database is locked」で落ちる(公式Docの明記)。
// 起動直後は _layout の syncAll と observe の loadAll が同時に同期へ入るけん、
// 二重に走らせると片方が必ず落ちる。相乗りなら書き込みは常に1本で、結果も同じ。
//
// 走っとる間に来た呼び出しには同じ Promise を返す(失敗も共有する)。
// 終わったあとに来た呼び出しは、新しく走らせる。
export function singleFlight<T>(run: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    if (!inFlight) {
      inFlight = run().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
}
