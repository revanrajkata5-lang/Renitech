const { Pool } = require('pg');

// Render's managed PostgreSQL provides DATABASE_URL automatically when you
// link the database to this web service (see README for setup steps).
if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable. Add a PostgreSQL database in Render and link it to this service.');
}

const isLocal = (process.env.DATABASE_URL || '').includes('localhost')
  || (process.env.DATABASE_URL || '').includes('127.0.0.1');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Managed Postgres providers (Supabase, Render's own Postgres, etc.)
  // require SSL. Only skip it for a local database during development.
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('contact', 'quote')),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      company TEXT,
      services TEXT,
      budget TEXT,
      message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  console.log('Database ready: submissions table checked/created.');
}

module.exports = { pool, initDb };
