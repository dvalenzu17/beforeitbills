/**
 * Shared pg Pool singleton.
 * Imported by services that need direct DB access (anomalyDetector, etc.)
 * without pulling in the full db/index.js module.
 */
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => console.error('[pg:services] pool error', err.message));

export default pool;
