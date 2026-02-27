// Vercel serverless function: /api/config
// Returns the password hash from the environment variable PW_HASH.
// This way the hash is set in Vercel dashboard — not hardcoded in the HTML.
// The client fetches this on load and uses it for password verification.

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const hash = process.env.PW_HASH;

  if (!hash) {
    return res.status(500).json({ error: 'PW_HASH environment variable is not set.' });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ hash: hash.toLowerCase() });
}