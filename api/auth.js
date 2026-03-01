/**
 * /api/auth — ReelWave Account Auth
 *
 * POST /api/auth?action=register  { email, password }
 * POST /api/auth?action=login     { email, password }
 * POST /api/auth?action=logout    { token }
 * GET  /api/auth?action=verify    Header: Authorization: Bearer <token>
 *
 * Uses Neon (postgres) via @neondatabase/serverless
 * Env vars required: DATABASE_URL, JWT_SECRET
 * Optional: PW_HASH (global fallback password)
 */

import { neon } from '@neondatabase/serverless';
import { SignJWT, jwtVerify } from 'jose';

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

async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const salt = saltHex
    ? Uint8Array.from(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)))
    : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 },
    keyMaterial, 256
  );
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  const saltHexOut = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  return { hash: hashHex, salt: saltHexOut };
}

async function verifyPassword(password, storedHash, storedSalt) {
  const { hash } = await hashPassword(password, storedSalt);
  return hash === storedHash;
}

async function createToken(userId, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(key);
}

async function verifyToken(token, secret) {
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    const { payload } = await jwtVerify(token, key);
    return payload.sub;
  } catch (_) {
    return null;
  }
}

async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS rw_users (
      id         BIGSERIAL PRIMARY KEY,
      email      TEXT UNIQUE NOT NULL,
      pw_hash    TEXT NOT NULL,
      pw_salt    TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS rw_sessions (
      token      TEXT PRIMARY KEY,
      user_id    BIGINT REFERENCES rw_users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS rw_user_data (
      user_id    BIGINT PRIMARY KEY REFERENCES rw_users(id) ON DELETE CASCADE,
      settings   JSONB DEFAULT '{}',
      watchlist  JSONB DEFAULT '[]',
      continues  JSONB DEFAULT '[]',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const DATABASE_URL = process.env.DATABASE_URL;
  const JWT_SECRET = process.env.JWT_SECRET || 'reelwave-secret-change-me';

  if (!DATABASE_URL) return json({ error: 'Database not configured' }, 500);

  const sql = neon(DATABASE_URL);

  try {
    await ensureSchema(sql);
  } catch (e) {
    return json({ error: 'DB schema error: ' + e.message }, 500);
  }

  // ── REGISTER ──────────────────────────────────────
  if (action === 'register' && req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch (_) { return json({ error: 'Invalid JSON' }, 400); }
    const { email, password } = body || {};
    if (!email || !password) return json({ error: 'Email and password required' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Invalid email' }, 400);
    if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);

    const existing = await sql`SELECT id FROM rw_users WHERE lower(email) = lower(${email}) LIMIT 1`;
    if (existing.length) return json({ error: 'Email already registered' }, 409);

    const { hash, salt } = await hashPassword(password);
    const [user] = await sql`INSERT INTO rw_users (email, pw_hash, pw_salt) VALUES (lower(${email}), ${hash}, ${salt}) RETURNING id, email`;
    await sql`INSERT INTO rw_user_data (user_id) VALUES (${user.id}) ON CONFLICT DO NOTHING`;

    const token = await createToken(user.id, JWT_SECRET);
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await sql`INSERT INTO rw_sessions (token, user_id, expires_at) VALUES (${token}, ${user.id}, ${expires.toISOString()})`;

    return json({ ok: true, token, user: { id: user.id, email: user.email } });
  }

  // ── LOGIN ─────────────────────────────────────────
  if (action === 'login' && req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch (_) { return json({ error: 'Invalid JSON' }, 400); }
    const { email, password } = body || {};
    if (!email || !password) return json({ error: 'Email and password required' }, 400);

    // Global password fallback
    const PW_HASH = process.env.PW_HASH;
    if (email === '__global__' && PW_HASH) {
      const inputHash = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password)))
      ).map(b => b.toString(16).padStart(2, '0')).join('');
      if (inputHash.toLowerCase() !== PW_HASH.toLowerCase()) {
        return json({ error: 'Incorrect password' }, 401);
      }
      return json({ ok: true, token: '__global__', user: { id: 0, email: 'guest', isGlobal: true } });
    }

    const [user] = await sql`SELECT id, email, pw_hash, pw_salt FROM rw_users WHERE lower(email) = lower(${email}) LIMIT 1`;
    if (!user) return json({ error: 'No account found with that email' }, 401);
    const ok = await verifyPassword(password, user.pw_hash, user.pw_salt);
    if (!ok) return json({ error: 'Incorrect password' }, 401);

    const token = await createToken(user.id, JWT_SECRET);
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await sql`INSERT INTO rw_sessions (token, user_id, expires_at) VALUES (${token}, ${user.id}, ${expires.toISOString()})`;

    return json({ ok: true, token, user: { id: user.id, email: user.email } });
  }

  // ── LOGOUT ────────────────────────────────────────
  if (action === 'logout' && req.method === 'POST') {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (token && token !== '__global__') {
      await sql`DELETE FROM rw_sessions WHERE token = ${token}`;
    }
    return json({ ok: true });
  }

  // ── VERIFY ────────────────────────────────────────
  if (action === 'verify' && req.method === 'GET') {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return json({ error: 'No token' }, 401);
    if (token === '__global__') return json({ ok: true, user: { id: 0, email: 'guest', isGlobal: true } });

    const userId = await verifyToken(token, JWT_SECRET);
    if (!userId) return json({ error: 'Invalid or expired token' }, 401);

    const [session] = await sql`SELECT user_id FROM rw_sessions WHERE token = ${token} AND expires_at > NOW() LIMIT 1`;
    if (!session) return json({ error: 'Session expired' }, 401);

    const [user] = await sql`SELECT id, email FROM rw_users WHERE id = ${userId} LIMIT 1`;
    if (!user) return json({ error: 'User not found' }, 401);

    return json({ ok: true, user: { id: user.id, email: user.email } });
  }

  return json({ error: 'Unknown action' }, 400);
}
