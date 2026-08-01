import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMissingGraduatedOn } from '../vows';

// isMissingGraduatedOn は「マイグレーション 003 未適用(graduated_on 列なし)」の
// 一点だけを拾う判定。ここで広く拾いすぎると、通信断や RLS エラーまで
// 旧スキーマ扱いになって卒業の導線が黙って畳まれ、狭すぎると計測中の誓いが
// 初回モードに化ける(実際に起きた事故)。両側をテストで留める。

test('列なしエラー(42703)を旧スキーマとして拾う', () => {
  assert.equal(
    isMissingGraduatedOn({
      code: '42703',
      message: 'column measured_saved.graduated_on does not exist',
    }),
    true,
  );
  // PostgREST がスキーマキャッシュ経由で返す形(書き込み時)も同じ列名を含む
  assert.equal(
    isMissingGraduatedOn({
      code: 'PGRST204',
      message: "Could not find the 'graduated_on' column of 'measured_vows' in the schema cache",
    }),
    true,
  );
});

test('列と無関係なエラーは拾わない(通信断・RLS など)', () => {
  assert.equal(isMissingGraduatedOn(null), false);
  assert.equal(isMissingGraduatedOn(undefined), false);
  assert.equal(isMissingGraduatedOn({ message: 'TypeError: Network request failed' }), false);
  assert.equal(
    isMissingGraduatedOn({ code: '42501', message: 'permission denied for table measured_vows' }),
    false,
  );
  assert.equal(isMissingGraduatedOn({ code: '42703', message: undefined }), false);
});
