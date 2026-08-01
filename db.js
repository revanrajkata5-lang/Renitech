const { Pool } = require('pg');

// Render's managed PostgreSQL provides DATABASE_URL automatically when you
// link the database to this web service (see README for setup steps).
if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable. Add a PostgreSQL database in Render and link it to this service.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render's internal Postgres connections don't require SSL, but external/
  // some regions do. This setting works for both without failing locally.
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : false
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
