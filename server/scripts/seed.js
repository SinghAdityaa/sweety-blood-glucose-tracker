import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { todayInTimezone } from '../src/domain/dates.js';

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, '../../.env') });
const { pool } = await import('../src/db.js');

const name = process.env.DEMO_USER_NAME || 'Sweety Demo';
const email = (process.env.DEMO_USER_EMAIL || 'demo@sweety.local').trim().toLowerCase();
const password = process.env.DEMO_USER_PASSWORD || 'SweetyDemo123!';
const today = todayInTimezone(process.env.APP_TIMEZONE);

try {
  const passwordHash = await bcrypt.hash(password, 12);
  const userResult = await pool.query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name, email, passwordHash],
  );
  const userId = userResult.rows[0].id;
  const samples = [
    ['morning_fasting', 108],
    ['after_breakfast', 142],
    ['after_lunch', 129],
  ];
  for (const [slot, value] of samples) {
    await pool.query(
      `INSERT INTO readings (user_id, reading_date, time_slot, value_mg_dl)
       VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, reading_date, time_slot) DO NOTHING`,
      [userId, today, slot, value],
    );
  }
  console.log(`Demo account ready: ${email} (date ${today}).`);
  console.log('Set DEMO_USER_PASSWORD in .env before running this script if you want a different local demo password.');
} catch (error) {
  console.error('Seed failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
