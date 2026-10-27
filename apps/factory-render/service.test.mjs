import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, mkdir, symlink, writeFile, utimes } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { request as httpRequest } from "node:http";
import { once } from "node:events";
import { Readable } from "node:stream";
import { createFactoryServer, createDiskStore } from "./service.mjs";

const workspace = "11111111-1111-1111-1111-111111111111";
const project = "22222222-2222-2222-2222-222222222222";
const build = "33333333-3333-3333-3333-333333333333";
const upload = "44444444-4444-4444-4444-444444444444";
const prefix = `factory/${workspace}/${project}/${build}/`;
const key = `${prefix}preview/index.html`;
const secret = "storage-" + "a".repeat(40);
const previewSecret = "preview-" + "b".repeat(40);
const bearer = { authorization: `Bearer ${secret}` };
const token = "a".repeat(48);
const html = "<!doctype html><title>Checked preview</title>";
const manifest = { files: [{ path: "index.html", contentType: "text/html; charset=utf-8", size: Buffer.byteLength(html), sha256: createHash("sha256").update(html).digest("hex") }] };
async function fixture(t, options = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "factory-render-test-"));
  const env = { FACTORY_STORAGE_DIRECTORY: directory, FACTORY_STORAGE_SECRET: secret, FACTORY_PREVIEW_SECRET: previewSecret, FACTORY_RESOLVER_URL: "https://www.tailoredagents.com/api/integrations/factory/preview" };
  const server = await createFactoryServer({ env, ...options });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  const object = (objectKey = key, maximumBytes) => `${origin}/internal/storage/object?key=${encodeURIComponent(objectKey)}${maximumBytes === undefined ? "" : `&maxBytes=${maximumBytes}`}`;
  const put = (value = html, objectKey = key) => fetch(object(objectKey), { method: "PUT", headers: bearer, body: value });
  const remove = deletePrefix => fetch(`${origin}/internal/storage/prefix?prefix=${encodeURIComponent(deletePrefix)}`, { method: "DELETE", headers: bearer });
  return { directory, env, server, origin, object, put, remove };
}

test("private storage authenticates every method and health reveals no secrets", async t => {
  const f = await fixture(t);
  for (const method of ["GET", "PUT"]) {
    const result = await fetch(f.object(), { method, body: method === "PUT" ? "secret" : undefined });
    assert.equal(result.status, 401); assert.equal(result.headers.get("access-control-allow-origin"), null);
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(await result.text(), /storage-|preview-/);
  }
  assert.equal((await fetch(`${f.origin}/internal/storage/prefix?prefix=${encodeURIComponent(prefix)}`, { method: "DELETE" })).status, 401);
  assert.equal((await fetch(f.object(), { headers: { authorization: `Bearer ${previewSecret}` } })).status, 401);
  const healthy = await fetch(`${f.origin}/health`);
  assert.equal(healthy.status, 200); assert.equal(await healthy.text(), "ready");
  assert.equal((await fetch(`${f.origin}/anything`)).status, 404);
});

test("actual HTTP roundtrip preserves bytes, maximum bounds, empty files and missing objects", async t => {
  const f = await fixture(t);
  assert.equal((await fetch(f.object(), { headers: bearer })).status, 404);
  assert.equal((await f.put()).status, 204);
  const response = await fetch(f.object(), { headers: bearer });
  assert.equal(response.status, 200); assert.equal(await response.text(), html);
  assert.equal(response.headers.get("content-type"), "application/octet-stream");
  assert.equal((await fetch(f.object(key, 2), { headers: bearer })).status, 413);
  for (const bound of ["-1", "1.1", "64000001", "NaN"]) assert.equal((await fetch(f.object(key, bound), { headers: bearer })).status, 400);
  assert.equal((await f.put("", `${prefix}empty.txt`)).status, 204);
  assert.equal(await (await fetch(f.object(`${prefix}empty.txt`, 0), { headers: bearer })).text(), "");
});

test("rejects traversal, malformed keys and overly broad cleanup without touching neighbors", async t => {
  const f = await fixture(t);
  await f.put();
  for (const invalid of ["../../outside", `${prefix}../outside`, `${prefix}a//b`, `${prefix}a\\b`, `${prefix}a%2fb`, `${prefix}${"a".repeat(501)}`]) {
    assert.equal((await f.put("bad", invalid)).status, 400);
    assert.equal((await fetch(f.object(invalid), { headers: bearer })).status, 400);
  }
  for (const invalid of [`factory/${workspace}/${project}/`, `${prefix}preview/`, `${prefix}preview/index.html`, `factory/${workspace}/${project}/uploads/`]) assert.equal((await f.remove(invalid)).status, 400);
  const image = `factory/${workspace}/${project}/uploads/${upload}.png`;
  await f.put("image", image);
  assert.equal((await f.remove(image)).status, 204);
  assert.equal((await fetch(f.object(image), { headers: bearer })).status, 404);
  assert.equal((await fetch(f.object(), { headers: bearer })).status, 200);
  assert.equal((await f.remove(prefix)).status, 204);
  assert.equal((await f.remove(prefix)).status, 204);
  assert.equal((await fetch(f.object(), { headers: bearer })).status, 404);
});

test("symlink parents and leaves cannot read, replace or delete outside storage", async t => {
  const f = await fixture(t);
  const outside = await mkdtemp(path.join(os.tmpdir(), "factory-outside-test-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(path.join(outside, "index.html"), "outside");
  const buildDirectory = path.join(f.directory, `factory/${workspace}/${project}/${build}`);
  await mkdir(buildDirectory, { recursive: true });
  await symlink(outside, path.join(buildDirectory, "preview"), process.platform === "win32" ? "junction" : "dir");
  assert.equal((await f.put("replace")).status, 503);
  assert.equal((await fetch(f.object(), { headers: bearer })).status, 503);
  assert.equal((await f.remove(prefix)).status, 503);
  assert.equal(await readFile(path.join(outside, "index.html"), "utf8"), "outside");
});

test("failed and oversized uploads leave committed content intact and remove temporary data", async t => {
  const f = await fixture(t);
  await f.put();
  const tooLarge = await new Promise((resolve, reject) => {
    const request = httpRequest(f.object(), { method: "PUT", headers: { ...bearer, "content-length": "64000001" } }, response => { response.resume(); resolve(response.statusCode); });
    request.on("error", reject); request.end();
  });
  assert.equal(tooLarge, 413);
  const store = await createDiskStore(f.directory);
  const oneMegabyte = Buffer.alloc(1_000_000, 1);
  await assert.rejects(store.put(key, Readable.from((async function* () { for (let index = 0; index < 65; index++) yield oneMegabyte; })()), null), error => error.status === 413);
  await assert.rejects(store.put(key, Readable.from([Buffer.from("short")]), 99), error => error.status === 400);
  assert.equal(await (await fetch(f.object(), { headers: bearer })).text(), html);
  assert.deepEqual(await readdir(path.join(f.directory, prefix, "preview")), ["index.html"]);
});

test("write and deletion serialize; readers observe only complete old or new objects", async t => {
  const f = await fixture(t);
  await f.put();
  const store = await createDiskStore(f.directory);
  let release, started;
  const waiting = new Promise(resolve => { release = resolve; });
  const begun = new Promise(resolve => { started = resolve; });
  const writing = store.put(key, Readable.from((async function* () { started(); yield Buffer.from("new"); await waiting; yield Buffer.from(" site"); })()), null);
  await begun;
  assert.equal(await (await fetch(f.object(), { headers: bearer })).text(), html);
  const deleting = store.deletePrefix(prefix);
  release(); await writing; await deleting;
  assert.equal(await store.read(key), null);
});

test("existing public preview verification, revocation, manifest, hash and isolation remain enforced", async t => {
  let mode = "ready", lastRequest;
  const f = await fixture(t, { fetcher: async (url, init) => {
    assert.equal(url, "https://www.tailoredagents.com/api/integrations/factory/preview");
    assert.equal(init.headers.authorization, `Bearer ${previewSecret}`);
    lastRequest = JSON.parse(init.body);
    if (mode === "revoked") return new Response("Unavailable", { status: 404 });
    return Response.json({ storagePrefix: `${prefix}preview/`, ready: mode !== "verifying", expiresAt: new Date(Date.now() + 60_000).toISOString(), manifest });
  } });
  await f.put();
  const preview = `${f.origin}/p/${token}/`;
  const response = await fetch(preview);
  assert.equal(response.status, 200); assert.equal(await response.text(), html);
  assert.match(response.headers.get("content-security-policy"), /connect-src 'none'/);
  assert.match(response.headers.get("x-robots-tag"), /noindex/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.deepEqual(lastRequest, { token, verification: false });
  assert.equal((await fetch(preview, { method: "HEAD" })).status, 200);
  const redirect = await fetch(preview.slice(0, -1), { redirect: "manual" });
  assert.equal(redirect.status, 308); assert.equal(redirect.headers.get("location"), `/p/${token}/`);
  assert.equal((await fetch(`${preview}unlisted.html`)).status, 404);
  assert.equal((await fetch(`${f.origin}/${key}`)).status, 404);
  mode = "verifying";
  assert.equal((await fetch(preview)).status, 404);
  assert.equal((await fetch(preview, { headers: { "x-factory-verify": previewSecret } })).status, 200);
  assert.equal(lastRequest.verification, true);
  mode = "ready";
  await f.put("x".repeat(Buffer.byteLength(html)));
  assert.equal((await fetch(preview)).status, 503);
  await f.put(); mode = "revoked";
  assert.equal((await fetch(preview)).status, 404);
});

test("startup removes only aged service temporary files and rejects missing secrets", async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "factory-startup-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const stale = path.join(directory, `.upload-${upload}`);
  const fresh = path.join(directory, `.health-${build}`);
  await writeFile(stale, "abandoned"); await utimes(stale, new Date(0), new Date(0));
  await writeFile(fresh, "new"); await writeFile(path.join(directory, "keep.txt"), "keep");
  await createDiskStore(directory);
  assert.deepEqual((await readdir(directory)).sort(), [`.health-${build}`, "keep.txt"].sort());
  await assert.rejects(createFactoryServer({ env: { FACTORY_STORAGE_DIRECTORY: directory } }), /not configured/);
  const env = { FACTORY_STORAGE_DIRECTORY: directory, FACTORY_STORAGE_SECRET: secret, FACTORY_PREVIEW_SECRET: previewSecret };
  await assert.rejects(createFactoryServer({ env }), /resolver is not configured/);
  await assert.rejects(createFactoryServer({ env: { ...env, FACTORY_RESOLVER_URL: "https://untrusted.invalid/" } }), /resolver is not configured/);
  await assert.rejects(createFactoryServer({ env: { ...env, FACTORY_STORAGE_SECRET: secret + "\ninvalid" } }), /secrets are not configured/);
});

test("a slow upload consumes a bounded service slot and releases it when complete", async t => {
  const f = await fixture(t, { maxActiveRequests: 1, maxQueuedRequests: 0 });
  const started = once(f.server, "request");
  let finish;
  const uploadStatus = new Promise((resolve, reject) => {
    const request = httpRequest(f.object(), { method: "PUT", headers: bearer }, response => { response.resume(); resolve(response.statusCode); });
    request.on("error", reject); request.write("part one"); finish = () => request.end("part two");
  });
  await started;
  assert.equal((await fetch(`${f.origin}/health`)).status, 503);
  finish(); assert.equal(await uploadStatus, 204);
  assert.equal((await fetch(`${f.origin}/health`)).status, 200);
});

test("a browser-sized preview burst waits for bounded slots instead of losing assets", async t => {
  let activeResolvers = 0, peakResolvers = 0;
  const f = await fixture(t, { fetcher: async () => {
    activeResolvers++; peakResolvers = Math.max(peakResolvers, activeResolvers);
    await new Promise(resolve => setTimeout(resolve, 100));
    activeResolvers--;
    return Response.json({ storagePrefix: `${prefix}preview/`, ready: true, expiresAt: new Date(Date.now() + 60_000).toISOString(), manifest });
  } });
  await f.put();
  const statuses = await Promise.all(Array.from({ length: 8 }, async () => {
    const response = await fetch(`${f.origin}/p/${token}/`);
    const body = await response.text();
    if (response.ok) assert.equal(body, html);
    return response.status;
  }));
  assert.deepEqual(statuses, Array(8).fill(200));
  assert.ok(peakResolvers <= 4, `Resolver concurrency exceeded the four-request limit: ${peakResolvers}`);
});

test("the bounded request queue rejects excess work and serves the waiting request after release", async t => {
  const f = await fixture(t, { maxActiveRequests: 1, maxQueuedRequests: 1 });
  let finish;
  const uploadStarted = once(f.server, "request");
  const uploadStatus = new Promise((resolve, reject) => {
    const request = httpRequest(f.object(), { method: "PUT", headers: bearer }, response => { response.resume(); resolve(response.statusCode); });
    request.on("error", reject); request.write("first"); finish = () => request.end("second");
  });
  await uploadStarted;
  const queuedStarted = once(f.server, "request"), queued = fetch(`${f.origin}/health`);
  await queuedStarted;
  const excess = await fetch(`${f.origin}/health`);
  assert.equal(excess.status, 503); assert.equal(excess.headers.get("retry-after"), "1");
  finish(); assert.equal(await uploadStatus, 204);
  const accepted = await queued;
  assert.equal(accepted.status, 200); assert.equal(await accepted.text(), "ready");
});

test("queue timeout releases its waiting slot without starting storage or resolver work", async t => {
  let resolverCalls = 0;
  const f = await fixture(t, { maxActiveRequests: 1, maxQueuedRequests: 1, requestQueueTimeoutMs: 25,
    fetcher: async () => { resolverCalls++; throw new Error("A timed-out request must never start"); },
  });
  let finish;
  const uploadStarted = once(f.server, "request");
  const uploadStatus = new Promise((resolve, reject) => {
    const request = httpRequest(f.object(), { method: "PUT", headers: bearer }, response => { response.resume(); resolve(response.statusCode); });
    request.on("error", reject); request.write("first"); finish = () => request.end("second");
  });
  await uploadStarted;
  const timedOut = await fetch(`${f.origin}/p/${token}/`);
  assert.equal(timedOut.status, 503); assert.equal(resolverCalls, 0);
  const nextStarted = once(f.server, "request"), next = fetch(`${f.origin}/health`);
  await nextStarted;
  finish(); assert.equal(await uploadStatus, 204);
  assert.equal((await next).status, 200);
});

test("disconnecting a queued client immediately frees queue space and does not take a processing slot", async t => {
  const f = await fixture(t, { maxActiveRequests: 1, maxQueuedRequests: 1 });
  let finish;
  const uploadStarted = once(f.server, "request");
  const uploadStatus = new Promise((resolve, reject) => {
    const request = httpRequest(f.object(), { method: "PUT", headers: bearer }, response => { response.resume(); resolve(response.statusCode); });
    request.on("error", reject); request.write("first"); finish = () => request.end("second");
  });
  await uploadStarted;
  const disconnectedStarted = once(f.server, "request");
  const disconnected = httpRequest(`${f.origin}/health`);
  disconnected.on("error", () => {}); disconnected.end();
  const [, serverResponse] = await disconnectedStarted;
  const closed = once(serverResponse, "close"); disconnected.destroy(); await closed;
  const nextStarted = once(f.server, "request"), next = fetch(`${f.origin}/health`);
  await nextStarted;
  finish(); assert.equal(await uploadStatus, 204);
  assert.equal((await next).status, 200);
  assert.equal((await fetch(`${f.origin}/health`)).status, 200);
});

test("resolver streams are bounded before JSON allocation and long valid secrets authenticate", async t => {
  let cancelled = false;
  const f = await fixture(t, { fetcher: async () => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(100_000)); },
    cancel() { cancelled = true; },
  })) });
  await f.put();
  assert.equal((await fetch(`${f.origin}/p/${token}/`)).status, 503);
  assert.equal(cancelled, true);
  const longSecret = "s".repeat(4096);
  const second = await createFactoryServer({ env: { ...f.env, FACTORY_STORAGE_SECRET: longSecret } });
  second.listen(0, "127.0.0.1"); await once(second, "listening");
  t.after(async () => { second.closeAllConnections(); await new Promise(resolve => second.close(resolve)); });
  assert.equal((await fetch(`http://127.0.0.1:${second.address().port}/internal/storage/object?key=${encodeURIComponent(key)}`, { headers: { authorization: `Bearer ${longSecret}` } })).status, 200);
});
