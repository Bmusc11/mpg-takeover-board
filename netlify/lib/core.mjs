// MPG Takeover Board API core. Storage is passed in so it can be tested without Netlify.
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';

const DEFAULT_REMINDER_HASH = '6e1b98f738250191539adec13c1eb1e63be3e5a2d77db2a081955bb8ed57ea82';
const DEFAULT_TEAM = ['Brenden', 'Brittney', 'Brian'];
const STEP_KEYS = ['form6', 'termination', 'ownerLetter', 'form6Copy', 'portal', 'keys'];
const STEP_NAMES = {
  form6: 'Form 6 signed by the landlords',
  termination: 'Termination email sent from PropertyMe',
  ownerLetter: 'Change of management letter sent to owner',
  form6Copy: 'Copy of Form 6 sent to owner',
  portal: 'Owner portal set up and access sent',
  keys: 'Keys and files received from outgoing agent',
};
const ID_RE = /^[a-f0-9-]{36}$/;

const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const S = (v, n = 300) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const D = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const text = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

export const brisToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const utc = (s) => { const p = s.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); };
const daysBetween = (from, to) => Math.round((utc(to) - utc(from)) / 864e5);
const longDate = (s) => new Date(utc(s)).toLocaleDateString('en-AU', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// Builds the stored fields from a request body. Only keys present in the body are returned.
function cleanPatch(b) {
  const out = {};
  if (!isObj(b)) return out;
  for (const k of ['street', 'suburb', 'keyNote', 'assignee']) if (k in b) out[k] = S(b[k], k === 'keyNote' ? 200 : 160);
  if ('postcode' in b) out.postcode = S(b.postcode, 10);
  if ('noticeDate' in b) out.noticeDate = D(b.noticeDate);
  if ('handoverDate' in b) out.handoverDate = D(b.handoverDate);
  if ('noticeDays' in b) { const n = parseInt(b.noticeDays, 10); out.noticeDays = n > 0 && n <= 365 ? n : 30; }
  if ('handoverManual' in b) out.handoverManual = !!b.handoverManual;
  if ('owners' in b && Array.isArray(b.owners)) out.owners = b.owners.slice(0, 10).filter(isObj).map((o) => ({ name: S(o.name, 120), phone: S(o.phone, 40), email: S(o.email, 160) }));
  if ('agency' in b && isObj(b.agency)) { out.agency = {}; for (const k of ['name', 'contact', 'phone', 'email']) if (k in b.agency) out.agency[k] = S(b.agency[k], 160); }
  if ('steps' in b && isObj(b.steps)) {
    out.steps = {};
    for (const k of STEP_KEYS) if (isObj(b.steps[k])) {
      const done = !!b.steps[k].done;
      out.steps[k] = done ? { done: true, by: S(b.steps[k].by, 60), at: new Date().toISOString() } : { done: false, by: '', at: '' };
    }
  }
  if ('handover' in b && isObj(b.handover)) {
    out.handover = b.handover.done ? { done: true, by: S(b.handover.by, 60), at: new Date().toISOString() } : { done: false, by: '', at: '' };
  }
  return out;
}
function merge(a, b) {
  for (const k of Object.keys(b)) {
    if (isObj(b[k]) && isObj(a[k])) merge(a[k], b[k]); else a[k] = b[k];
  }
  return a;
}
function finalise(t, prevHandover) {
  const now = new Date().toISOString();
  t.steps = t.steps || {};
  for (const k of STEP_KEYS) if (!isObj(t.steps[k])) t.steps[k] = { done: false, by: '', at: '' };
  if (!isObj(t.handover)) t.handover = { done: false, by: '', at: '' };
  t.completedAt = t.handover.done ? (t.handover.at || now) : '';
  if (prevHandover !== undefined && prevHandover !== t.handoverDate) t.reminders = { d7: '', d1: '', for: '' };
  if (!isObj(t.reminders)) t.reminders = { d7: '', d1: '', for: '' };
  t.updatedAt = now;
  return t;
}

async function loadAll(store) {
  const { blobs } = await store.list();
  const items = await Promise.all(blobs.map(async (b) => { const v = await store.get(b.key, { type: 'json' }); return v ? { ...v, id: b.key } : null; }));
  return items.filter(Boolean);
}

// Address lookup: Google Places API (New), called from the server so the key never reaches the browser.
const PLACES = 'https://places.googleapis.com/v1/';
const TOKEN_RE = /^[A-Za-z0-9-]{8,64}$/;
const PLACE_RE = /^[A-Za-z0-9_-]{10,300}$/;
const UNIT_RE = /^(unit|apartment|apt|flat|suite|villa|townhouse)\s*/i;
// Centre of the Logan to Gold Coast area, used only to rank nearby addresses first.
const BIAS = { circle: { center: { latitude: -27.8, longitude: 153.1 }, radius: 50000 } };

export function addressFrom(d) {
  const comps = Array.isArray(d?.addressComponents) ? d.addressComponents : [];
  const get = (type, short) => {
    const c = comps.find((x) => isObj(x) && Array.isArray(x.types) && x.types.includes(type));
    return c ? S(short ? c.shortText : c.longText, 120) : '';
  };
  const num = get('street_number'), route = get('route'), sub = get('subpremise');
  let street = [num, route].filter(Boolean).join(' ');
  if (sub && street) {
    const unit = sub.replace(UNIT_RE, '');
    street = /^[A-Za-z0-9-]+$/.test(unit) && num ? `${unit}/${street}` : `${sub}, ${street}`;
  }
  return {
    street,
    suburb: get('locality') || get('sublocality_level_1') || get('sublocality'),
    postcode: get('postal_code').slice(0, 4),
    state: get('administrative_area_level_1', true),
    formatted: S(d?.formattedAddress, 240),
  };
}

async function places(parts, url, env, fetchFn) {
  const key = env('GOOGLE_MAPS_API_KEY');
  if (!key) return json({ error: 'Address lookup is not set up' }, 503);
  const s = url.searchParams.get('s') || '';
  const sessionToken = TOKEN_RE.test(s) ? s : '';
  if (parts[1] === 'suggest') {
    const input = S(url.searchParams.get('q'), 120);
    if (input.length < 3) return json({ suggestions: [] });
    const base = { input, includedRegionCodes: ['au'], regionCode: 'au', languageCode: 'en-AU', locationBias: BIAS };
    if (sessionToken) base.sessionToken = sessionToken;
    const call = (body) => fetchFn(PLACES + 'places:autocomplete', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat' },
      body: JSON.stringify(body),
    });
    let r = await call({ ...base, includedPrimaryTypes: ['street_address', 'premise', 'subpremise', 'route'] });
    if (r.status === 400) r = await call(base); // fall back to all place types if Google rejects the type filter
    if (!r.ok) { console.error('places suggest', r.status, await r.text().catch(() => '')); return json({ error: 'Address lookup failed' }, 502); }
    const d = await r.json().catch(() => ({}));
    const suggestions = (Array.isArray(d.suggestions) ? d.suggestions : [])
      .map((x) => x && x.placePrediction).filter((p) => p && typeof p.placeId === 'string' && PLACE_RE.test(p.placeId)).slice(0, 6)
      .map((p) => ({ id: p.placeId, main: S(p.structuredFormat?.mainText?.text || p.text?.text, 200), secondary: S(p.structuredFormat?.secondaryText?.text, 200) }));
    return json({ suggestions });
  }
  if (parts[1] === 'detail') {
    const id = url.searchParams.get('id') || '';
    if (!PLACE_RE.test(id)) return json({ error: 'Bad address id' }, 400);
    const q = new URLSearchParams({ languageCode: 'en-AU', regionCode: 'au' });
    if (sessionToken) q.set('sessionToken', sessionToken);
    const r = await fetchFn(PLACES + 'places/' + encodeURIComponent(id) + '?' + q, { headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'addressComponents,formattedAddress' } });
    if (!r.ok) { console.error('places detail', r.status, await r.text().catch(() => '')); return json({ error: 'Address lookup failed' }, 502); }
    return json(addressFrom(await r.json().catch(() => ({}))));
  }
  return json({ error: 'Not found' }, 404);
}

function codeOk(req, env) {
  const given = req.headers.get('x-team-code') || '';
  if (!given) return false;
  const team = env('TEAM_CODE');
  if (!team) return false; // fail closed until TEAM_CODE is set in Netlify
  return same(sha(given), sha(team));
}

async function reminders(url, stores, env, now) {
  const key = url.searchParams.get('key') || '';
  const want = env('REMINDER_KEY') ? sha(env('REMINDER_KEY')) : DEFAULT_REMINDER_HASH;
  if (!key || !same(sha(key), want)) { await sleep(500); return text('Forbidden', 403); }
  const today = brisToday(now);
  const ack = url.searchParams.get('ack');
  if (ack) {
    let n = 0;
    for (const part of ack.split(',').slice(0, 50)) {
      const [id, kind] = part.split(':');
      if (!ID_RE.test(id || '') || !['d7', 'd1'].includes(kind)) continue;
      const t = await stores.takeovers.get(id, { type: 'json' });
      if (!t || !D(t.handoverDate)) continue;
      const r = isObj(t.reminders) && t.reminders.for === t.handoverDate ? { ...t.reminders } : { d7: '', d1: '' };
      r[kind] = today;
      if (kind === 'd1' && !r.d7) r.d7 = today;
      r.for = t.handoverDate;
      t.reminders = r;
      await stores.takeovers.setJSON(id, t);
      n++;
    }
    return text(`OK acknowledged ${n}`);
  }
  const due = [];
  for (const t of await loadAll(stores.takeovers)) {
    if (t.handover?.done || t.steps?.keys?.done || !D(t.handoverDate)) continue;
    const days = daysBetween(today, t.handoverDate);
    const r = isObj(t.reminders) && t.reminders.for === t.handoverDate ? t.reminders : {};
    let kind = null;
    if (days >= 0 && days <= 1 && !r.d1) kind = 'd1';
    else if (days >= 2 && days <= 7 && !r.d7) kind = 'd7';
    if (kind) due.push({ t, kind, days });
  }
  const lines = [`MPG key collection reminders for ${today} (Brisbane)`, `DUE: ${due.length}`];
  for (const { t, kind, days } of due) {
    const a = t.agency || {};
    lines.push('---',
      `id: ${t.id}`, `kind: ${kind}`, `days_until: ${days}`,
      `address: ${[t.street, t.suburb, t.postcode].filter(Boolean).join(', ')}`,
      `key_collection_date: ${longDate(t.handoverDate)}`,
      `time_and_place: ${t.keyNote || 'not set'}`,
      `outgoing_agency: ${[a.name, a.contact, a.phone].filter(Boolean).join(' | ') || 'not set'}`,
      `owners: ${(t.owners || []).map((o) => o.name).filter(Boolean).join(' & ') || 'not set'}`,
      `assigned: ${t.assignee || 'unassigned'}`,
      `outstanding_steps: ${STEP_KEYS.filter((k) => !t.steps?.[k]?.done).map((k) => STEP_NAMES[k]).join('; ') || 'none'}`);
  }
  lines.push('---', 'END');
  return text(lines.join('\n'));
}

export async function handle(req, stores, env = () => '', now = new Date(), fetchFn = (...a) => globalThis.fetch(...a)) {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const m = req.method;
  try {
    if (parts[0] === 'health') return json({ ok: true });
    if (parts[0] === 'reminders' && m === 'GET') return await reminders(url, stores, env, now);
    if (!codeOk(req, env)) { await sleep(500); return json({ error: 'Wrong team code' }, 401); }
    if (parts[0] === 'places' && m === 'GET') return await places(parts, url, env, fetchFn);
    let body = null;
    if (m === 'POST' || m === 'PATCH' || m === 'PUT') {
      if (Number(req.headers.get('content-length') || 0) > 100000) return json({ error: 'Too large' }, 413);
      try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
    }
    if (parts[0] === 'state' && m === 'GET') {
      const t = await stores.settings.get('team', { type: 'json' });
      return json({ takeovers: await loadAll(stores.takeovers), team: Array.isArray(t?.members) ? t.members : DEFAULT_TEAM, today: brisToday(now) });
    }
    if (parts[0] === 'takeovers') {
      const id = parts[1];
      if (!id && m === 'POST') {
        const nid = randomUUID();
        const t = finalise(merge({ street: '', suburb: '', postcode: '', owners: [], agency: { name: '', contact: '', phone: '', email: '' }, assignee: '', noticeDate: '', noticeDays: 30, handoverDate: '', handoverManual: false, keyNote: '', createdAt: new Date().toISOString() }, cleanPatch(body)));
        if (!t.street) return json({ error: 'Street address is required' }, 400);
        await stores.takeovers.setJSON(nid, t);
        return json({ ...t, id: nid }, 201);
      }
      if (id && ID_RE.test(id)) {
        const cur = await stores.takeovers.get(id, { type: 'json' });
        if (!cur) return json({ error: 'Not found' }, 404);
        if (m === 'PATCH') {
          const prev = cur.handoverDate;
          const t = finalise(merge(cur, cleanPatch(body)), prev);
          await stores.takeovers.setJSON(id, t);
          return json({ ...t, id });
        }
        if (m === 'DELETE') { await stores.takeovers.delete(id); return json({ ok: true }); }
      }
    }
    if (parts[0] === 'team' && m === 'PUT') {
      const members = Array.isArray(body?.members) ? [...new Set(body.members.map((x) => S(x, 60)).filter(Boolean))].slice(0, 30) : [];
      await stores.settings.setJSON('team', { members });
      return json({ members });
    }
    return json({ error: 'Not found' }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: 'Server error' }, 500);
  }
}
