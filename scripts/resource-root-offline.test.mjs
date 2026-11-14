import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {ensureRootOfflineFallback, ROOT_OFFLINE_WORKER} from '../resources/offline.mjs';
import {stageRootOfflineWorker} from './stage-resource-explorer.mjs';

const origin = 'https://example.test';
const source = await readFile(new URL('../offline-resources-worker.js', import.meta.url), 'utf8');
function worker(fetchImpl, {timeoutMs = 15} = {}) {
  const handlers = new Map();
  vm.runInNewContext(source, {URL, Response, AbortController,
    caches: new Proxy({}, {get() { throw new Error('Root recovery must not access caches'); }}),
    setTimeout: (fn) => setTimeout(fn, timeoutMs), clearTimeout,
    fetch: fetchImpl,
    self: {location: {origin}, addEventListener: (name, handler) => handlers.set(name, handler),
      skipWaiting: async () => {}, clients: {claim: async () => {}}},
  });
  return overrides => {
    let response;
    handlers.get('fetch')({request: {url: origin + '/', method: 'GET', mode: 'navigate', ...overrides}, respondWith: promise => { response = promise; }});
    return response;
  };
}

test('root recovery preserves successful,404 and500 navigation responses unchanged', async () => {
  for (const status of [200,404,500]) {
    const expected = new Response('original body', {status, headers: {'X-Existing': 'kept'}});
    let received;
    const navigate = worker(async (request, options) => { received = {request, options}; return expected; });
    const actual = await navigate();
    assert.equal(actual, expected);
    assert.equal(actual.headers.get('X-Existing'), 'kept');
    assert.equal(received.request.url, origin + '/');
    assert.ok(received.options.signal instanceof AbortSignal);
  }
});

test('failed or stalled root navigation redirects into the separate cached resource scope', async () => {
  for (const transport of [async () => { throw new Error('offline'); }, () => new Promise(() => {})]) {
    const response = await worker(transport)({url: origin + '/practice.html'});
    assert.equal(response.status,302);
    assert.equal(response.headers.get('Location'),origin + '/resources/');
  }
});

test('root recovery does not intercept resources, APIs, subresources, writes or another origin', () => {
  let calls = 0;
  const navigate = worker(() => { calls++; throw new Error('must not run'); });
  for (const request of [{url:origin+'/resources/'},{url:origin+'/resources'},{url:origin+'/resources/explorer.mjs'},
    {url:origin+'/api'},{url:origin+'/api/weather?city=Delhi'}, {url:'https://another.test/'}, {method:'POST'},
    {mode:'cors'},{mode:'same-origin'}]) assert.equal(navigate(request),undefined);
  assert.equal(calls,0);
});

test('registration installs only the root recovery worker and preserves every unknown worker', async () => {
  const script = origin + ROOT_OFFLINE_WORKER;
  for (const existing of [undefined,{scope:origin+'/',active:{scriptURL:script}}]) {
    const calls = [];
    const result = await ensureRootOfflineFallback({origin,serviceWorker:{getRegistration:async scope => {assert.equal(scope,origin+'/');return existing;},register:async (url,options) => {calls.push({url,options});return {scope:origin+'/'};}}});
    assert.equal(result.registered,true);assert.deepEqual(calls,[{url:script,options:{scope:'/',updateViaCache:'none'}}]);
  }
  for (const existing of [{scope:origin+'/'},{scope:origin+'/',active:{scriptURL:origin+'/app-worker.js'}},
    {scope:origin+'/',active:{scriptURL:script},waiting:{scriptURL:origin+'/future-app-worker.js'}}]) {
    let called = false;
    const result = await ensureRootOfflineFallback({origin,serviceWorker:{getRegistration:async()=>existing,register:async()=>{called=true;}}});
    assert.equal(result.registered,false);assert.equal(called,false);
  }
});

test('denied or stalled registration is bounded; a late scope lookup cannot overwrite a worker', async () => {
  let resolveLookup, called = false;
  const result = await ensureRootOfflineFallback({origin,timeoutMs:10,serviceWorker:{getRegistration:()=>new Promise(resolve=>{resolveLookup=resolve;}),register:async()=>{called=true;}}});
  assert.equal(result.registered,false);
  resolveLookup(undefined);await new Promise(resolve=>setImmediate(resolve));assert.equal(called,false);
  const denied = await ensureRootOfflineFallback({origin,serviceWorker:{getRegistration:async()=>{throw new Error('denied');}}});
  assert.equal(denied.registered,false);
});

test('root worker is explicitly staged separately from the ten-file resource shell', async t => {
  const root = await mkdtemp(join(tmpdir(),'resource-root-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await writeFile(join(root,'offline-resources-worker.js'),source);
  const output = join(root,'dist');
  await stageRootOfflineWorker(root,output);
  assert.equal(await readFile(join(output,'offline-resources-worker.js'),'utf8'),source);
});
