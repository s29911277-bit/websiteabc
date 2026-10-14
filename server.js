const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('node:path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const API_TOKEN = process.env.BORROWBOX_API_KEY || 'borrowbox-demo-key';
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
const pool = new Pool(databaseUrl ? {
  connectionString: databaseUrl,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000
} : {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'borrowbox',
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000
});

app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function requireApiAuth(req, res) {
  const auth = req.get('Authorization') || req.get('x-borrowbox-api-key') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (token === API_TOKEN) return true;
  res.status(401).json({ success: false, error: 'Authentication required.' });
  return false;
}

const emptyState = { users: {}, items: [], requests: [], history: [], reports: [] };
let schemaReady;
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = pool.query(`CREATE TABLE IF NOT EXISTS borrowbox_state (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`).catch(error => { schemaReady = null; throw error; });
  }
  return schemaReady;
}
app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  if (req.path === '/api/health') return next();
  if (!requireApiAuth(req, res)) return;
  if (!databaseUrl && !process.env.PGHOST) {
    return res.status(503).json({ success: false, error: 'Set DATABASE_URL in the Vercel project environment variables.' });
  }
  try { await ensureSchema(); next(); }
  catch (error) {
    console.error('PostgreSQL setup failed:', error.message);
    res.status(503).json({ success: false, error: 'PostgreSQL is unavailable. Check DATABASE_URL.' });
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, database: 'PostgreSQL' });
  } catch (error) {
    res.status(503).json({ success: false, error: 'PostgreSQL is unavailable.' });
  }
});

app.get('/api/state', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT state FROM borrowbox_state WHERE id = 1');
    res.json({ success: true, state: rows[0]?.state || null });
  } catch (error) {
    console.error('Could not read shared state:', error.message);
    res.status(500).json({ success: false, error: 'Could not load shared data.' });
  }
});

app.get('/api/items', async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT state->'items' AS items FROM borrowbox_state WHERE id = 1");
    res.json({ success: true, items: rows[0]?.items || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Could not load listings.' });
  }
});

app.put('/api/state', async (req, res) => {
  const state = req.body?.state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return res.status(400).json({ success: false, error: 'A valid state object is required.' });
  }
  const normalized = {
    ...emptyState,
    users: state.users && typeof state.users === 'object' ? state.users : {},
    items: Array.isArray(state.items) ? state.items : [],
    requests: Array.isArray(state.requests) ? state.requests : [],
    history: Array.isArray(state.history) ? state.history : [],
    reports: Array.isArray(state.reports) ? state.reports : []
  };
  try {
    await pool.query(
      `INSERT INTO borrowbox_state (id, state, updated_at) VALUES (1, $1::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
      [JSON.stringify(normalized)]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Could not save shared state:', error.message);
    res.status(500).json({ success: false, error: 'Could not save shared data.' });
  }
});

module.exports = app;
if (require.main === module) {
  app.listen(PORT, () => console.log(`BorrowBox API running at http://localhost:${PORT}`));
}
