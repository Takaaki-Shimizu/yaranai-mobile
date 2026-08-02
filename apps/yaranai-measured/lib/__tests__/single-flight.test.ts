import { test } from 'node:test';
import assert from 'node:assert/strict';
import { singleFlight } from '../single-flight';

// Promise を1拍あとに解決させるための小さな栓
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('走っとる間の呼び出しは進行中の1本に相乗りする', async () => {
  let runs = 0;
  const gate = deferred<void>();
  const sync = singleFlight(async () => {
    runs++;
    await gate.promise;
  });

  const a = sync();
  const b = sync(); // 並走(起動時の syncAll と observe の loadAll)を模す
  gate.resolve();
  await Promise.all([a, b]);
  assert.equal(runs, 1);
});

test('終わったあとの呼び出しは新しく走る', async () => {
  let runs = 0;
  const sync = singleFlight(async () => {
    runs++;
  });

  await sync();
  await sync();
  assert.equal(runs, 2);
});

test('失敗は相乗り中の呼び出しへも届き、次の呼び出しは走り直せる', async () => {
  let runs = 0;
  const gate = deferred<void>();
  const sync = singleFlight(async () => {
    runs++;
    if (runs === 1) {
      await gate.promise;
    }
  });

  const a = sync();
  const b = sync();
  gate.reject(new Error('database is locked'));
  await assert.rejects(a, /database is locked/);
  await assert.rejects(b, /database is locked/);

  // 失敗した Promise を掴んだままにせん(次は開き直す)
  await sync();
  assert.equal(runs, 2);
});
