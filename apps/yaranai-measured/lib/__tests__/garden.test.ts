import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveGrowth, mergeHighWater, type GardenSnapshot } from '../garden/growth';
import { isEngawaOpen, ENGAWA_CLOSED_MESSAGE } from '../garden/gate';
import { buildScene, cobbleCount, postPairCount, FRAME_X, FRAME_W } from '../garden/scene';
import type { Prim, Scene } from '../garden/scene-types';

const snap = (recordedDays: number, savedHours: number, stoneCount = 2): GardenSnapshot => ({
  stoneCount,
  recordedDays,
  savedMinutes: savedHours * 60,
});

// ---------------------------------------------------------------- 成長パラメータ

test('deriveGrowth: Day 1 / Day 42 / Day 84 の基準点', () => {
  const d1 = deriveGrowth(snap(1, 2));
  assert.equal(d1.weeks, 0);
  assert.equal(d1.redLeaf, false);
  assert.ok(d1.moss < 0.01);

  const d42 = deriveGrowth(snap(42, 360));
  assert.equal(d42.weeks, 6);
  assert.equal(d42.path, 0.5);
  assert.equal(d42.moss, 0.5);
  assert.equal(d42.redLeaf, false);

  const d84 = deriveGrowth(snap(84, 720));
  assert.equal(d84.weeks, 12);
  assert.equal(d84.path, 1);
  assert.equal(d84.moss, 1);
  assert.equal(d84.redLeaf, true);
});

test('deriveGrowth: 週数は記録がある日数でだけ進む(放置では育たない)', () => {
  // 30日放置しても記録7日なら1週
  assert.equal(deriveGrowth(snap(7, 10)).weeks, 1);
  assert.equal(deriveGrowth(snap(6, 10)).weeks, 0);
});

test('deriveGrowth: 上限を超えても飽和する', () => {
  const g = deriveGrowth(snap(200, 2000, 5));
  assert.equal(g.weeks, 12);
  assert.equal(g.path, 1);
  assert.equal(g.moss, 1);
  assert.equal(g.stones, 3);
});

test('mergeHighWater: どの成分も後退しない', () => {
  const prev = snap(40, 300, 3);
  const broken = snap(35, 250, 1); // データ側の事故を想定
  const merged = mergeHighWater(prev, broken);
  assert.deepEqual(merged, prev);
  const better = snap(41, 310, 3);
  assert.deepEqual(mergeHighWater(prev, better), better);
  assert.deepEqual(mergeHighWater(null, prev), prev);
});

// ---------------------------------------------------------------- 週次開扉

test('週次開扉: 日曜の暦日だけ開く', () => {
  // 2026-07-05 は日曜
  assert.equal(isEngawaOpen(new Date(2026, 6, 5, 0, 0)), true);
  assert.equal(isEngawaOpen(new Date(2026, 6, 5, 23, 59)), true);
  assert.equal(isEngawaOpen(new Date(2026, 6, 6, 0, 0)), false); // 月曜0:00
  assert.equal(isEngawaOpen(new Date(2026, 6, 7)), false);
  assert.equal(isEngawaOpen(new Date(2026, 6, 11)), false); // 土曜
  assert.equal(isEngawaOpen(new Date(2026, 6, 12)), true);
});

test('閉扉メッセージにカウントダウン数字が無い', () => {
  assert.ok(!/[0-9０-９]/.test(ENGAWA_CLOSED_MESSAGE));
});

// ---------------------------------------------------------------- 敷石・杭

test('cobbleCount: モック3パネルの基準値と単調非減少', () => {
  assert.equal(cobbleCount(0), 0);
  assert.equal(cobbleCount(1), 3);
  assert.equal(cobbleCount(42), 24);
  assert.equal(cobbleCount(84), 35);
  assert.equal(cobbleCount(200), 35);
  for (let n = 1; n <= 120; n++) {
    assert.ok(cobbleCount(n) >= cobbleCount(n - 1), `cobbleCount(${n}) が後退`);
  }
});

test('postPairCount: Day1=1 / Day42=3 / Day84=6 と単調非減少', () => {
  assert.equal(postPairCount(1), 1);
  assert.equal(postPairCount(42), 3);
  assert.equal(postPairCount(84), 6);
  for (let n = 1; n <= 120; n++) {
    assert.ok(postPairCount(n) >= postPairCount(n - 1));
  }
});

// ---------------------------------------------------------------- シーン

function countPrims(scene: Scene, pred: (p: Prim, layerId: string) => boolean): number {
  let c = 0;
  for (const layer of scene.layers) {
    for (const group of layer.groups) {
      for (const prim of group.prims) if (pred(prim, layer.id)) c++;
    }
  }
  return c;
}

const inFrame = (x: number) => x >= FRAME_X && x <= FRAME_X + FRAME_W;

test('シーンは決定論的(同じデータなら同じ庭)', () => {
  const g = deriveGrowth(snap(42, 360));
  assert.equal(JSON.stringify(buildScene(g)), JSON.stringify(buildScene(g)));
});

test('Day 42: 中央パネルの房の数がモックと一致する', () => {
  const scene = buildScene(deriveGrowth(snap(42, 360)));
  const tufts = (layerId: string) =>
    countPrims(scene, (p, id) => id === layerId && p.kind === 'tuft' && inFrame(p.x));
  assert.equal(tufts('field'), 4 + 7); // 遠景4 + 中景7
  // 前景は8 + 主石の根元の一房(石グループ)
  assert.equal(tufts('fore'), 8);
});

test('Day 1: 房は主石の根元の一房だけ、敷石3枚、杭1対', () => {
  const scene = buildScene(deriveGrowth(snap(1, 0.5)));
  assert.equal(countPrims(scene, (p) => p.kind === 'tuft'), 1);
  assert.equal(cobbleCount(1), 3);
});

test('朱のひとひらは Day 84 到達時のみ、一枚だけ', () => {
  const shu = (scene: Scene) =>
    countPrims(scene, (p) => p.kind === 'path' && 'paint' in p && !!p.paint &&
      p.paint.type === 'solid' && p.paint.color === '#B0472F');
  assert.equal(shu(buildScene(deriveGrowth(snap(83, 700)))), 0);
  assert.equal(shu(buildScene(deriveGrowth(snap(84, 300)))), 1);
});

test('単調非減少: 崩れた日を含む84日系列で庭の要素が後退しない', () => {
  // 3日に1日は崩れる(=その日は苔が増えない)系列。記録は毎日ある
  let saved = 0;
  let prevSnap: GardenSnapshot | null = null;
  let prevCounts: number[] | null = null;
  for (let day = 1; day <= 84; day++) {
    const crashed = day % 3 === 0;
    saved += crashed ? 0 : 9 * 60; // 崩れなかった日は9時間戻す(→84日で約720h×0.66)
    const merged = mergeHighWater(prevSnap, snap(day, saved / 60));
    prevSnap = merged;
    const scene = buildScene(deriveGrowth(merged));
    const counts = [
      countPrims(scene, (p) => p.kind === 'tuft'),
      cobbleCount(merged.recordedDays),
      postPairCount(merged.recordedDays),
      scene.layers.length,
      countPrims(scene, (p) => p.kind === 'polygon'), // 影・光条
    ];
    if (prevCounts) {
      counts.forEach((c, i) => {
        assert.ok(c >= prevCounts![i], `day ${day}: 指標${i}が ${prevCounts![i]} → ${c} に後退`);
      });
    }
    prevCounts = counts;
  }
});

test('房のスケールも m に対して単調非減少', () => {
  let prevScales: Map<string, number> | null = null;
  for (let mi = 0; mi <= 20; mi++) {
    const scene = buildScene(deriveGrowth(snap(84, (720 * mi) / 20)));
    const scales = new Map<string, number>();
    for (const layer of scene.layers) {
      for (const group of layer.groups) {
        for (const prim of group.prims) {
          if (prim.kind === 'tuft') scales.set(`${layer.id}:${prim.x},${prim.y}`, prim.scale);
        }
      }
    }
    if (prevScales) {
      for (const [key, s] of prevScales) {
        const now = scales.get(key);
        assert.ok(now != null, `m=${mi / 20}: 房 ${key} が消えた`);
        assert.ok(now! >= s - 1e-9, `m=${mi / 20}: 房 ${key} が縮んだ`);
      }
    }
    prevScales = scales;
  }
});
