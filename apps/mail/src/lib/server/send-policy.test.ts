import { businessDateKey, nextBusinessMidnight } from '../time';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	apiSendPolicy,
	claimDailySend,
	DEFAULT_API_DAILY_SEND_LIMIT,
	refundDailySend
} from './send-policy';
import { createTestDb, insertTestUser } from './test-db';

describe('apiSendPolicy', () => {
	test('sends require an explicit enabled setting', () => {
		assert.deepEqual(apiSendPolicy({}), {
			enabled: false,
			dailyLimit: DEFAULT_API_DAILY_SEND_LIMIT
		});
		assert.deepEqual(apiSendPolicy(undefined), {
			enabled: false,
			dailyLimit: DEFAULT_API_DAILY_SEND_LIMIT
		});
	});

	test('API_SEND_ENABLED=false turns token sending off', () => {
		assert.equal(apiSendPolicy({ API_SEND_ENABLED: 'false' }).enabled, false);
		assert.equal(apiSendPolicy({ API_SEND_ENABLED: ' FALSE ' }).enabled, false);
		assert.equal(apiSendPolicy({ API_SEND_ENABLED: 'true' }).enabled, true);
	});

	test('API_DAILY_SEND_LIMIT sets the cap, and 0 removes it', () => {
		assert.equal(apiSendPolicy({ API_DAILY_SEND_LIMIT: '25' }).dailyLimit, 25);
		assert.equal(apiSendPolicy({ API_DAILY_SEND_LIMIT: '0' }).dailyLimit, null);
	});

	test('a malformed limit keeps the default instead of lifting the cap', () => {
		assert.equal(apiSendPolicy({ API_DAILY_SEND_LIMIT: 'lots' }).dailyLimit, 100);
		assert.equal(apiSendPolicy({ API_DAILY_SEND_LIMIT: '-5' }).dailyLimit, 100);
		assert.equal(apiSendPolicy({ API_DAILY_SEND_LIMIT: '2.5' }).dailyLimit, 100);
	});
});

describe('claimDailySend', () => {
	test('allows exactly the limit, then refuses', async () => {
		const { db, sqlite } = createTestDb();
		insertTestUser(sqlite, 'user-1');

		const outcomes = [];
		for (let i = 0; i < 4; i++) outcomes.push(await claimDailySend(db, 'user-1', 3));

		assert.deepEqual(outcomes, [true, true, true, false]);
	});

	test('a refunded slot can be used again', async () => {
		const { db, sqlite } = createTestDb();
		insertTestUser(sqlite, 'user-1');
		const day = businessDateKey();

		assert.equal(await claimDailySend(db, 'user-1', 1, day), true);
		await refundDailySend(db, 'user-1', day);
		assert.equal(await claimDailySend(db, 'user-1', 1, day), true);
		assert.equal(await claimDailySend(db, 'user-1', 1, day), false);
	});

	test('counts each user separately', async () => {
		const { db, sqlite } = createTestDb();
		insertTestUser(sqlite, 'user-1');
		insertTestUser(sqlite, 'user-2');

		assert.equal(await claimDailySend(db, 'user-1', 1), true);
		assert.equal(await claimDailySend(db, 'user-1', 1), false);
		assert.equal(await claimDailySend(db, 'user-2', 1), true);
	});
});


test('Eastern allowance crosses midnight once, including the repeated fall hour', async () => {
  const { db, sqlite } = createTestDb(); insertTestUser(sqlite, 'user-1');
  const day = (at: string) => businessDateKey(new Date(at));
  assert.equal(await claimDailySend(db, 'user-1', 1, day('2026-11-01T03:59:59Z')), true);
  assert.equal(await claimDailySend(db, 'user-1', 1, day('2026-11-01T04:00:00Z')), true);
  for (const at of ['2026-11-01T05:30:00Z','2026-11-01T06:30:00Z','2026-11-02T04:59:59Z']) {
    assert.equal(await claimDailySend(db, 'user-1', 1, day(at)), false);
  }
  assert.equal(nextBusinessMidnight(new Date('2026-11-01T04:00:00Z')), '2026-11-02T05:00:00.000Z');
  assert.equal(await claimDailySend(db, 'user-1', 1, day('2026-11-02T05:00:00Z')), true);
  // A late refund must credit the original day's reservation, never today's.
  await refundDailySend(db, 'user-1', '2026-11-01');
  assert.equal(await claimDailySend(db, 'user-1', 1, '2026-11-02'), false);
  assert.equal(await claimDailySend(db, 'user-1', 1, '2026-11-01'), true);
});
