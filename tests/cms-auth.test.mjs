import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { generateKeyPair, SignJWT, jwtVerify } from 'jose';
import { editor, validatePublish, writablePath, readableRoute, publish, github } from '../lib/cms-email.mjs';

const env = { CF_ACCESS_TEAM_DOMAIN: 'avc-test.cloudflareaccess.com', CF_ACCESS_AUD: 'app-audience', CMS_GITHUB_TOKEN: 'test-only' };
const authRequest = new Request('https://amwellvalley.pages.dev/api/session', { headers: { 'Cf-Access-Jwt-Assertion': 'test-jwt' } });
const request = origin => new Request('https://amwellvalley.pages.dev/api/publish', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
});
test('authentication fails closed without configuration or session', async () => {
  await assert.rejects(editor(authRequest, {}), { status: 503 });
  await assert.rejects(editor(new Request(authRequest.url), env), { status: 401 });
});
test('JWT signature, issuer, audience and expiration are verified', async () => {
  await editor(authRequest, env, async (token, keys, options) => {
    assert.equal(token, 'test-jwt');
    assert.equal(options.issuer, 'https://avc-test.cloudflareaccess.com');
    assert.equal(options.audience, env.CF_ACCESS_AUD);
    assert.deepEqual(options.algorithms, ['RS256']);
    assert.ok(options.requiredClaims.includes('exp'));
    return { payload: { email: 'alfredo@h7marketing.com' } };
  });
  await assert.rejects(editor(authRequest, env, async () => { throw new Error('bad signature'); }), { status: 401 });
});
test('only the two authorized editor emails are accepted', async () => {
  for (const email of ['alfredo@h7marketing.com', 'yogaboy27@mac.com']) {
    assert.equal((await editor(authRequest, env, async () => ({ payload: { email } }))).email, email);
  }
  await assert.rejects(editor(authRequest, env, async () => ({ payload: { email: 'other@example.com' } })), { status: 403 });
});
test('CMS cannot modify application code, workflows, secrets or traversal paths', () => {
  for (const path of ['.github/workflows/cloudflare-pages.yml', 'functions/api/session.js', 'static/admin/config.yml', 'static/images/../../package.json', 'static/images/evil.js', 'content/../package.json']) {
    assert.equal(writablePath(path), false, path);
  }
  assert.equal(writablePath('content/calendar-of-events.md'), true);
  assert.equal(writablePath('data/settings.toml'), true);
  assert.equal(writablePath('static/images/nick.jpg'), true);
});
test('publishing requires same-origin JSON and valid nonduplicated files', () => {
  const body = { files: [{ path: 'content/_index.md', content: 'YWJj' }] };
  validatePublish(request('https://amwellvalley.pages.dev'), body);
  assert.throws(() => validatePublish(request('https://attacker.example'), body), { status: 403 });
  assert.throws(() => validatePublish(request('https://amwellvalley.pages.dev'), { files: [...body.files, ...body.files] }), { status: 400 });
  assert.throws(() => validatePublish(request('https://amwellvalley.pages.dev'), { files: [{ path: 'package.json', content: 'YWJj' }] }), { status: 403 });
});
test('proxy permits read operations only and no administrative endpoints', () => {
  assert.equal(readableRoute('/git/trees/main:static/images'), true);
  for (const path of ['/actions/secrets', '/hooks', '/collaborators', '/git/refs/heads/main']) assert.equal(readableRoute(path), false);
});
test('GitHub transport uses edge-compatible manual redirects and refuses redirect responses', async () => {
  await assert.rejects(github(env, '', {}, async (url, options) => {
    assert.equal(options.redirect, 'manual');
    return new Response(null, { status: 302, headers: { Location: 'https://other.example' } });
  }), { status: 502 });
});
test('publish creates a content-only commit with editor attribution and never force-pushes', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.headers.Authorization, 'Bearer test-only');
    let data = { sha: 'new-sha' };
    if (url.endsWith('/git/ref/heads/main')) data = { object: { sha: 'parent-sha' } };
    if (url.endsWith('/git/commits/parent-sha')) data = { tree: { sha: 'base-tree' } };
    return Response.json(data);
  };
  await publish(env, { files: [{ path: 'content/_index.md', content: 'YWJj' }] }, { name: 'Editor', email: 'yogaboy27@mac.com' }, fetcher);
  const commit = calls.find(c => c.url.endsWith('/git/commits'));
  assert.equal(JSON.parse(commit.options.body).author.email, 'yogaboy27@mac.com');
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), { sha: 'new-sha', force: false });
  assert.equal(calls.at(-1).options.method, 'PATCH');
});

test('real JWT cryptography rejects expired and wrong-audience email sessions', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const verify = (token, unused, options) => jwtVerify(token, publicKey, options);
  const sign = (aud, exp) => new SignJWT({ email: 'alfredo@h7marketing.com' })
    .setProtectedHeader({ alg: 'RS256' }).setIssuer(`https://${env.CF_ACCESS_TEAM_DOMAIN}`)
    .setAudience(aud).setSubject('editor').setIssuedAt().setExpirationTime(exp).sign(privateKey);
  const req = token => new Request(authRequest.url, { headers: { 'Cf-Access-Jwt-Assertion': token } });
  assert.equal((await editor(req(await sign(env.CF_ACCESS_AUD, '1h')), env, verify)).email, 'alfredo@h7marketing.com');
  await assert.rejects(editor(req(await sign('other-app', '1h')), env, verify), { status: 401 });
  await assert.rejects(editor(req(await sign(env.CF_ACCESS_AUD, 1)), env, verify), { status: 401 });
});

test('Decap adapter registers before init and redirects all content writes through the server', async () => {
  let Adapter, initialized = false;
  const calls = [];
  const api = { toBase64: async raw => Buffer.from(raw).toString('base64') };
  const delegate = { api, authenticate: async () => ({ email: 'alfredo@h7marketing.com' }), logout() {} };
  const context = {
    window: {
      h() {}, createClass: definition => definition,
      location: { assign() {} },
      CMS: { getBackend: () => ({ init: () => delegate }),
        registerBackend(name, type) { assert.equal(name, 'cloudflare-email'); Adapter = type; },
        init() { assert.ok(Adapter); initialized = true; } },
    },
    fetch: async (path, options) => {
      calls.push({ path, options });
      return Response.json(path === '/api/publish' ? { files: [{ path: 'content/_index.md', sha: 'saved' }] } : { email: 'alfredo@h7marketing.com' });
    },
  };
  vm.runInNewContext(fs.readFileSync(new URL('../static/admin/email-backend.js', import.meta.url), 'utf8'), context);
  assert.equal(initialized, true);
  const backend = new Adapter({}, {});
  await backend.authenticate({ token: 'email-session' });
  const file = { path: 'content/_index.md', raw: 'Updated content' };
  await api.persistFiles([file], [], { commitMessage: 'Update home' });
  assert.equal(file.sha, 'saved');
  const upload = calls.find(c => c.path === '/api/publish');
  assert.equal(upload.options.credentials, 'same-origin');
  assert.equal(JSON.parse(upload.options.body).files[0].content, Buffer.from(file.raw).toString('base64'));
  assert.equal(upload.options.headers.Authorization, undefined);
});
