import { createRemoteJWKSet, jwtVerify } from 'jose';

export const REPO = 'alfredoh7/one-click-hugo-cms-f7fbf';
const ORIGIN = 'https://amwellvalley.pages.dev';
const EDITORS = new Set(['alfredo@h7marketing.com', 'yogaboy27@mac.com']);
const PAGES = new Set([
  '_index', 'content-directory', 'calendar-of-events', 'club-rules',
  'bird-hunting-safety-rules', 'membership-categories',
  'other-hunting-privileges', 'fields-map',
].map(name => `content/${name}.md`));
const keys = new Map();

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function editor(request, env, verify = jwtVerify) {
  if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD || !env.CMS_GITHUB_TOKEN) {
    throw Object.assign(new Error('CMS authentication is not configured.'), { status: 503 });
  }
  const team = env.CF_ACCESS_TEAM_DOMAIN;
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team)) {
    throw Object.assign(new Error('Invalid authentication configuration.'), { status: 503 });
  }
  const token = request.headers.get('Cf-Access-Jwt-Assertion') ||
    request.headers.get('Cookie')?.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1];
  if (!token) throw Object.assign(new Error('Please sign in with your email.'), { status: 401 });
  if (!keys.has(team)) keys.set(team, createRemoteJWKSet(new URL(`https://${team}/cdn-cgi/access/certs`)));
  let payload;
  try {
    ({ payload } = await verify(token, keys.get(team), {
      issuer: `https://${team}`, audience: env.CF_ACCESS_AUD, algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat', 'sub', 'email'],
    }));
  } catch {
    throw Object.assign(new Error('Your email session expired. Please sign in again.'), { status: 401 });
  }
  const email = String(payload.email || '').toLowerCase();
  if (!EDITORS.has(email)) throw Object.assign(new Error('This email cannot edit the site.'), { status: 403 });
  return { email, name: email.split('@')[0], login: email.split('@')[0] };
}

export function writablePath(path) {
  if (typeof path !== 'string' || path.split('/').some(p => !p || p === '.' || p === '..') || /[\\\x00-\x1f]/.test(path)) return false;
  return PAGES.has(path) || path === 'data/settings.toml' ||
    /^static\/images\/[a-zA-Z0-9_ ./-]+\.(?:jpg|jpeg|png|gif|webp|avif|svg|pdf)$/i.test(path);
}

export function validatePublish(request, body) {
  if (request.method !== 'POST' || request.headers.get('Origin') !== ORIGIN ||
      !request.headers.get('Content-Type')?.startsWith('application/json')) {
    throw Object.assign(new Error('Invalid publishing request.'), { status: 403 });
  }
  if (!body || !Array.isArray(body.files) || !body.files.length || body.files.length > 40 ||
      body.files.some(file => !file || typeof file !== 'object') ||
      new Set(body.files.map(f => f.path)).size !== body.files.length) {
    throw Object.assign(new Error('Invalid file list.'), { status: 400 });
  }
  for (const file of body.files) {
    if (!writablePath(file.path) || (file.delete !== true &&
        (typeof file.content !== 'string' || file.content.length > 20_000_000 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.content)))) {
      throw Object.assign(new Error('Only CMS content and media can be changed.'), { status: 403 });
    }
  }
}

export async function github(env, path, options = {}, fetcher = fetch) {
  const response = await fetcher(`https://api.github.com/repos/${REPO}${path}`, {
    ...options, redirect: 'error', headers: {
      Authorization: `Bearer ${env.CMS_GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json', 'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'AVC-Email-CMS',
    },
  });
  if (!response.ok) throw Object.assign(new Error(response.status === 422 ?
    'Content changed during publishing. Reload the editor and try again.' :
    'Repository request failed. Check the CMS publishing credential.'), { status: response.status === 422 ? 409 : 502 });
  return response.json();
}

export async function publish(env, body, user, fetcher = fetch) {
  const call = (path, data) => github(env, path, data ? {
    method: 'POST', body: JSON.stringify(data),
  } : {}, fetcher);
  const head = await call('/git/ref/heads/main');
  const parent = await call(`/git/commits/${head.object.sha}`);
  const tree = [];
  for (const file of body.files) {
    const blob = file.delete ? null : await call('/git/blobs', { content: file.content, encoding: 'base64' });
    tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob?.sha || null });
  }
  const nextTree = await call('/git/trees', { base_tree: parent.tree.sha, tree });
  const commit = await call('/git/commits', {
    message: String(body.message || 'Update website content').slice(0, 500),
    tree: nextTree.sha, parents: [head.object.sha],
    author: { name: user.name, email: user.email },
  });
  // A non-force update fails safely if another editor published concurrently.
  await github(env, '/git/refs/heads/main', {
    method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }),
  }, fetcher);
  return { commit: commit.sha, files: tree };
}

export function readableRoute(path) {
  return path === '' || path === '/commits' ||
    /^\/git\/blobs\/[a-f0-9]{40}$/.test(path) ||
    /^\/git\/trees\/[A-Za-z0-9_:/.-]+$/.test(path) ||
    /^\/contents\/[A-Za-z0-9_ /.-]+$/.test(path);
}

export async function handle(context, action) {
  try {
    const user = await editor(context.request, context.env);
    return await action(user);
  } catch (error) {
    if (!error.status) console.error('CMS internal error', error.name,
      String(error.message).replace(/(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]+/g, '[redacted]'));
    return json({ message: error.status ? error.message : 'The CMS request could not be completed.' }, error.status || 500);
  }
}
