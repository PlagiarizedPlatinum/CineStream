/**
 * /api/user — ReelWave User Data Sync
 *
 * GET  /api/user?field=all|settings|watchlist|continues   (reads data)
 * POST /api/user?field=settings|watchlist|continues       (writes data)
 *
 * All requests require: Authorization: Bearer <token>
 * Global token (__global__) uses localStorage only — no DB storage.
 *
 * Env vars: DATABASE_URL, JWT_SECRET
 */

import { neon } from '@neondatabase/serverless';
import { jwtVerify } from 'jose';

export const config = { runtime: 'edge' };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function getUserIdFromToken(token, JWT_SECRET) {
  try {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
    );
    const { payload } = await jwtVerify(token, key);
    return payload.sub;
  } catch (_) {
    return null;
  }
}

const VALID_FIELDS = ['settings', 'watchlist', 'continues'];

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  const JWT_SECRET = process.env.JWT_SECRET || 'reelwave-secret-change-me';

  if (!DATABASE_URL) return json({ error: 'Database not configured' }, 500);

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token || token === '__global__') {
    return json({ error: 'Global login uses local storage only' }, 400);
  }

  const sql = neon(DATABASE_URL);
  const userId = await getUserIdFromToken(token, JWT_SECRET);
  if (!userId) return json({ error: 'Invalid token' }, 401);

  // Verify session is still valid
  const [session] = await sql`SELECT user_id FROM rw_sessions WHERE token = ${token} AND expires_at > NOW() LIMIT 1`;
  if (!session) return json({ error: 'Session expired, please log in again' }, 401);

  const url = new URL(req.url);
  const field = url.searchParams.get('field') || 'all';

  // ── GET ───────────────────────────────────────────
  if (req.method === 'GET') {
    await sql`INSERT INTO rw_user_data (user_id) VALUES (${userId}) ON CONFLICT DO NOTHING`;
    const [row] = await sql`SELECT settings, watchlist, continues FROM rw_user_data WHERE user_id = ${userId}`;
    if (!row) return json({ settings: {}, watchlist: [], continues: [] });

    if (field === 'all') {
      return json({ settings: row.settings || {}, watchlist: row.watchlist || [], continues: row.continues || [] });
    }
    if (VALID_FIELDS.includes(field)) {
      return json({ [field]: row[field] || (field === 'settings' ? {} : []) });
    }
    return json({ error: 'Invalid field' }, 400);
  }

  // ── POST ──────────────────────────────────────────
  if (req.method === 'POST') {
    if (!VALID_FIELDS.includes(field)) return json({ error: 'Invalid field' }, 400);

    let body;
    try { body = await req.json(); } catch (_) { return json({ error: 'Invalid JSON' }, 400); }

    const value = body[field];
    if (value === undefined) return json({ error: `Missing field: ${field}` }, 400);

    await sql`INSERT INTO rw_user_data (user_id) VALUES (${userId}) ON CONFLICT DO NOTHING`;

    if (field === 'settings') {
      await sql`UPDATE rw_user_data SET settings = ${JSON.stringify(value)}, updated_at = NOW() WHERE user_id = ${userId}`;
    } else if (field === 'watchlist') {
      await sql`UPDATE rw_user_data SET watchlist = ${JSON.stringify(value)}, updated_at = NOW() WHERE user_id = ${userId}`;
    } else if (field === 'continues') {
      await sql`UPDATE rw_user_data SET continues = ${JSON.stringify(value)}, updated_at = NOW() WHERE user_id = ${userId}`;
    }

    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
