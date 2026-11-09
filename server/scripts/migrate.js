import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, '../../.env') });
const { pool } = await import('../src/db.js');

try {
  const sql = await readFile(resolve(here, '../migrations/001_initial_schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Database migration applied.');
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
