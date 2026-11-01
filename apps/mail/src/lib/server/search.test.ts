import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchClauses } from './search';
import { createTestDb, insertTestUser } from './test-db';

test('date search uses Eastern midnight for ISO and D1 timestamps across DST', () => {
  const { sqlite } = createTestDb(); insertTestUser(sqlite, 'user-1');
  const stamps = ['2026-03-08 04:59:59','2026-03-08 05:00:00','2026-03-09T03:59:59Z','2026-03-09T04:00:00Z'];
  for (const [id, at] of stamps.entries()) sqlite.query("INSERT INTO emails(id,user_id,direction,from_addr,to_addr,subject,created_at) VALUES(?,?,'inbound','sender@example.test','owner@example.test','test',?)").run(String(id),'user-1',at);
  const {filters,bindings} = searchClauses('after:2026-03-08 before:2026-03-09');
  const rows = sqlite.query(`SELECT id FROM emails e WHERE user_id=? AND ${filters.join(' AND ')} ORDER BY id`).all('user-1',...bindings);
  assert.deepEqual(rows.map((r: any) => r.id), ['1','2']);
  assert.deepEqual(searchClauses('after:2026-02-30').filters,['0=1']);
});
