import { getStore } from '@netlify/blobs';
import { handle } from '../lib/core.mjs';

const env = (k) => (globalThis.Netlify?.env?.get?.(k) ?? process.env[k] ?? '');

export default async (req) => handle(req, {
  get takeovers() { return getStore({ name: 'takeovers', consistency: 'strong' }); },
  get settings() { return getStore({ name: 'settings', consistency: 'strong' }); },
}, env);

export const config = { path: '/api/*' };
