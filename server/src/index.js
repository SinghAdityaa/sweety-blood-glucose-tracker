import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, '../../.env') });
const [{ app }, { pool }] = await Promise.all([import('./app.js'), import('./db.js')]);

const port = Number(process.env.API_PORT || 4000);
const server = app.listen(port, () => console.log(`Sweety API listening on http://localhost:${port}`));

async function shutdown(signal) {
  console.log(`${signal} received; shutting down gracefully.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
