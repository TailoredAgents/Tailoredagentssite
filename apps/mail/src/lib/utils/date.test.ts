import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatFullDate, formatMailDate, formatMailTime, shouldShowSeparateTime } from './date';

test('Mail interprets stored UTC and displays Georgia time on devices elsewhere', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-07-02T03:00:00Z') });
  assert.equal(formatMailTime('2026-07-01 16:30:00'), '12:30 PM');
  assert.match(formatFullDate('2026-01-15 15:30:00'), /10:30 AM EST/);
  assert.match(formatFullDate('2026-07-15T15:30:00Z'), /11:30 AM EDT/);
  // More than twelve hours ago, but still the same Eastern day.
  assert.equal(formatMailDate('2026-07-01T05:00:00Z'), '1:00 AM');
  assert.equal(shouldShowSeparateTime('2026-07-01T05:00:00Z'), false);
  assert.equal(formatMailTime('bad'), '');
});
