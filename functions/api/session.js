import { handle, json } from '../../lib/cms-email.mjs';

export const onRequestGet = context => handle(context, user => json(user));
