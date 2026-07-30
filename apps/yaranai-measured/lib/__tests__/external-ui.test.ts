import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXTERNAL_UI_GRACE_MS,
  isExternalUiReturn,
  resetExternalUiForTest,
  withExternalUi,
} from '../external-ui';

test('何も開いとらんときは印は立たん(通常のバックグラウンド復帰)', () => {
  resetExternalUiForTest();
  assert.equal(isExternalUiReturn(), false);
});

test('OS の画面を開いとる間は印が立つ(復帰イベントが先に届く場合)', async () => {
  resetExternalUiForTest();
  let sawFlag = false;
  await withExternalUi(async () => {
    sawFlag = isExternalUiReturn();
  });
  assert.equal(sawFlag, true);
});

test('閉じた直後の猶予の間は印が立つ(約束が先に解ける場合)', async () => {
  resetExternalUiForTest();
  await withExternalUi(async () => {});
  const now = Date.now();
  assert.equal(isExternalUiReturn(now), true);
  assert.equal(isExternalUiReturn(now + EXTERNAL_UI_GRACE_MS), true);
});

test('猶予を過ぎたら印は消える(送り先アプリから戻る復帰には演出を挟む)', async () => {
  resetExternalUiForTest();
  await withExternalUi(async () => {});
  assert.equal(isExternalUiReturn(Date.now() + EXTERNAL_UI_GRACE_MS + 1), false);
});

test('失敗しても印は残さん。例外はそのまま通す', async () => {
  resetExternalUiForTest();
  let caught: unknown = null;
  try {
    await withExternalUi(async () => {
      throw new Error('share failed');
    });
  } catch (e) {
    caught = e;
  }
  assert.equal((caught as Error | null)?.message, 'share failed');
  assert.equal(isExternalUiReturn(Date.now() + EXTERNAL_UI_GRACE_MS + 1), false);
});

test('続けて開いたら猶予は仕切り直し', async () => {
  resetExternalUiForTest();
  await withExternalUi(async () => {});
  const firstClosed = Date.now();
  await withExternalUi(async () => {
    // 前回の猶予が切れとっても、開いとる間は印が立つ
    assert.equal(isExternalUiReturn(firstClosed + EXTERNAL_UI_GRACE_MS + 1), true);
  });
});
