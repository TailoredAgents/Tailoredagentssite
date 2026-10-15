import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Miniflare, Response as EdgeResponse, convertV4MiniflareOptions } from 'miniflare';
import ts from 'typescript';

test('provider downloads work in the Workers runtime without following redirects', async (t) => {
  // Execute the actual client in workerd: Node fetch accepts redirect modes
  // that the deployed Workers runtime rejects before making any request.
  const source = await readFile(new URL('../src/lib/server/resend.ts', import.meta.url), 'utf8');
  const script = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText + `
    export default { async fetch(request) {
      try {
        return await createResendClient('test-api-key-must-stay-private')
          .downloadResponse(await request.text());
      } catch {
        return new Response('Download unavailable', {status: 502});
      }
    }};
  `;
  const requests: { url: string; authorization: string | null }[] = [];
  let upstreamStatus = 200;
  const runtime = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script,
    compatibilityDate: '2026-10-14',
    compatibilityFlags: ['nodejs_compat'],
    outboundService: async (request) => {
      requests.push({ url: request.url, authorization: request.headers.get('authorization') });
      return new EdgeResponse(upstreamStatus === 200 ? 'original file bytes' : 'unavailable', {
        status: upstreamStatus,
        headers: upstreamStatus === 302 ? { Location: 'https://untrusted.example/file' } : {}
      });
    }
  }));
  t.after(() => runtime.dispose());
  const download = (url: string) => runtime.dispatchFetch('https://app.test/download', {
    method: 'POST', body: url
  });

  await t.test('downloads complete bytes without sending the API key to the file host', async () => {
    const response = await download('https://files.resend.test/photo?signature=current');
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'original file bytes');
    assert.deepEqual(requests, [{
      url: 'https://files.resend.test/photo?signature=current', authorization: null
    }]);
  });

  await t.test('rejects a redirect without requesting its destination', async () => {
    requests.length = 0;
    upstreamStatus = 302;
    assert.equal((await download('https://files.resend.test/redirect')).status, 502);
    assert.deepEqual(requests.map(r => r.url), ['https://files.resend.test/redirect']);
  });

  await t.test('an expired link can be retried with a fresh signed link', async () => {
    requests.length = 0;
    upstreamStatus = 403;
    assert.equal((await download('https://files.resend.test/photo?signature=expired')).status, 502);
    upstreamStatus = 200;
    const response = await download('https://files.resend.test/photo?signature=renewed');
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'original file bytes');
    assert.equal(requests.length, 2);
  });
});
