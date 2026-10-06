import { handle, json, publish, validatePublish } from '../../lib/cms-email.mjs';

export const onRequestPost = context => handle(context, async user => {
  if (Number(context.request.headers.get('Content-Length')) > 25_000_000) return json({ message: 'Upload is too large.' }, 413);
  const text = await context.request.text();
  if (text.length > 25_000_000) return json({ message: 'Upload is too large.' }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ message: 'Invalid upload.' }, 400); }
  validatePublish(context.request, body);
  return json(await publish(context.env, body, user));
});
