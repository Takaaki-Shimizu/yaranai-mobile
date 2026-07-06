import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMinutes } from '../format';

test('60分未満は分のまま', () => {
  assert.equal(formatMinutes(0), '0分');
  assert.equal(formatMinutes(22), '22分');
  assert.equal(formatMinutes(59), '59分');
});

test('60分以上は時間+分', () => {
  assert.equal(formatMinutes(60), '1時間');
  assert.equal(formatMinutes(126), '2時間6分');
  assert.equal(formatMinutes(54 + 56 + 20), '2時間10分');
});

test('端数と負値の丸め', () => {
  assert.equal(formatMinutes(53.6), '54分');
  assert.equal(formatMinutes(59.5), '1時間');
  assert.equal(formatMinutes(-5), '0分');
});
