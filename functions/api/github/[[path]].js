import { handle, json, github, readableRoute, REPO } from '../../../lib/cms-email.mjs';

export const onRequestGet = context => handle(context, async user => {
  const url = new URL(context.request.url);
  let path;
  try { path = decodeURIComponent(url.pathname.slice('/api/github'.length)); }
  catch { return json({ message: 'Invalid path.' }, 400); }
  if (path === '/user') return json(user);
  const prefix = `/repos/${REPO}`;
  if (!path.startsWith(prefix)) return json({ message: 'Repository is not allowed.' }, 403);
  const route = path.slice(prefix.length);
  if (!readableRoute(route) || route.includes('..')) return json({ message: 'API operation is not allowed.' }, 403);
  const data = await github(context.env, route + url.search);
  if (route === '') data.permissions = { ...data.permissions, push: true };
  return json(data);
});
