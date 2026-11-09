import pg from 'pg';
import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || '';
export let pool;

if (connectionString.startsWith('pglite://')) {
  const { PGlite } = await import('@electric-sql/pglite');
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const dataDir = resolve(repositoryRoot, connectionString.slice('pglite://'.length));
  await mkdir(dataDir, { recursive: true });
  const database = await PGlite.create(dataDir);

  async function query(sql, values = []) {
    if (values.length === 0 && /;\s*\S/.test(sql.trim().replace(/;\s*$/, ''))) {
      await database.exec(sql);
      return { rows: [], rowCount: null };
    }
    const result = await database.query(sql, values);
    return {
      rows: result.rows,
      rowCount: result.rows.length || result.affectedRows || 0,
    };
  }

  pool = {
    query,
    async connect() {
      return { query, release() {} };
    },
    end: () => database.close(),
  };
} else {
  pool = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_SIZE || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  pool.on('error', (error) => {
    console.error('Unexpected idle PostgreSQL client error:', error.message);
  });
}
