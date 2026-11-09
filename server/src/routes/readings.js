import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth/session.js';
import { SLOT_KEYS, SLOTS } from '../domain/constants.js';
import { isCalendarDate, todayInTimezone } from '../domain/dates.js';
import { validateReadingInput } from '../domain/validation.js';

const router = Router();
router.use(requireAuth);

function asReading(row) {
  return {
    id: row.id,
    date: row.reading_date,
    slot: row.time_slot,
    slotLabel: SLOTS[row.time_slot],
    value: row.value_mg_dl,
  };
}

function sendValidationError(response, error) {
  if (error.name !== 'ValidationError') return false;
  response.status(400).json({ error: { code: error.code, message: error.message } });
  return true;
}

function duplicateSlotMessage(slotKey) {
  const slot = SLOTS[slotKey];
  if (!slot) return 'A reading already exists for this time slot and date.';
  const article = /^[aeiou]/i.test(slot) ? 'an' : 'a';
  return `You already have ${article} ${slot} reading for this date.`;
}

async function getExistingState(client, userId, date, excludeId) {
  const values = [userId, date];
  let exclusion = '';
  if (excludeId) {
    values.push(excludeId);
    exclusion = ' AND id <> $3';
  }
  const result = await client.query(
    `SELECT time_slot FROM readings WHERE user_id = $1 AND reading_date = $2${exclusion}`,
    values,
  );
  return { count: result.rowCount, slots: result.rows.map((row) => row.time_slot) };
}

router.get('/', async (request, response, next) => {
  try {
    const date = request.query.date || todayInTimezone(process.env.APP_TIMEZONE);
    if (!isCalendarDate(date)) {
      return response.status(400).json({ error: { code: 'INVALID_DATE', message: 'Please choose a valid date.' } });
    }
    const result = await pool.query(
      `SELECT id, to_char(reading_date, 'YYYY-MM-DD') AS reading_date, time_slot, value_mg_dl
       FROM readings WHERE user_id = $1 AND reading_date = $2
       ORDER BY CASE time_slot
         WHEN 'morning_fasting' THEN 1
         WHEN 'after_breakfast' THEN 2
         WHEN 'after_lunch' THEN 3
         ELSE 4 END`,
      [request.userId, date],
    );
    return response.json({ readings: result.rows.map(asReading) });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (request, response, next) => {
  const client = await pool.connect();
  try {
    const date = request.body?.date;
    const existing = date && isCalendarDate(date)
      ? await getExistingState(client, request.userId, date)
      : { count: 0, slots: [] };
    const reading = validateReadingInput(request.body, {
      today: todayInTimezone(process.env.APP_TIMEZONE),
      existingCount: existing.count,
      existingSlots: existing.slots,
    });
    const result = await client.query(
      `INSERT INTO readings (user_id, reading_date, time_slot, value_mg_dl)
       VALUES ($1, $2, $3, $4)
       RETURNING id, to_char(reading_date, 'YYYY-MM-DD') AS reading_date, time_slot, value_mg_dl`,
      [request.userId, reading.date, reading.slot, reading.value],
    );
    return response.status(201).json({ reading: asReading(result.rows[0]) });
  } catch (error) {
    if (sendValidationError(response, error)) return;
    if (error.code === '23505') {
      return response.status(409).json({ error: { code: 'DUPLICATE_SLOT', message: duplicateSlotMessage(request.body?.slot) } });
    }
    return next(error);
  } finally {
    client.release();
  }
});

router.patch('/:id', async (request, response, next) => {
  const client = await pool.connect();
  try {
    const currentResult = await client.query(
      `SELECT id, to_char(reading_date, 'YYYY-MM-DD') AS reading_date, time_slot, value_mg_dl
       FROM readings WHERE id = $1 AND user_id = $2`,
      [request.params.id, request.userId],
    );
    const current = currentResult.rows[0];
    if (!current) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Reading not found.' } });

    const date = request.body?.date;
    const existing = date && isCalendarDate(date)
      ? await getExistingState(client, request.userId, date, current.id)
      : { count: 0, slots: [] };
    const reading = validateReadingInput(request.body, {
      today: todayInTimezone(process.env.APP_TIMEZONE),
      existingCount: existing.count,
      existingSlots: existing.slots,
    });
    const result = await client.query(
      `UPDATE readings
       SET reading_date = $1, time_slot = $2, value_mg_dl = $3, updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING id, to_char(reading_date, 'YYYY-MM-DD') AS reading_date, time_slot, value_mg_dl`,
      [reading.date, reading.slot, reading.value, current.id, request.userId],
    );
    return response.json({ reading: asReading(result.rows[0]) });
  } catch (error) {
    if (sendValidationError(response, error)) return;
    if (error.code === '23505') {
      return response.status(409).json({ error: { code: 'DUPLICATE_SLOT', message: duplicateSlotMessage(request.body?.slot) } });
    }
    return next(error);
  } finally {
    client.release();
  }
});

router.delete('/:id', async (request, response, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM readings WHERE id = $1 AND user_id = $2 RETURNING id',
      [request.params.id, request.userId],
    );
    if (!result.rowCount) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Reading not found.' } });
    return response.status(204).end();
  } catch (error) {
    return next(error);
  }
});

export default router;
