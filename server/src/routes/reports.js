import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth/session.js';
import { SLOTS } from '../domain/constants.js';
import { formatRange, getReportRange, isCalendarDate, todayInTimezone } from '../domain/dates.js';
import { summarizeReadings } from '../domain/reports.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (request, response, next) => {
  try {
    const date = request.query.date || todayInTimezone(process.env.APP_TIMEZONE);
    const range = request.query.range || 'daily';
    if (!isCalendarDate(date)) {
      return response.status(400).json({ error: { code: 'INVALID_DATE', message: 'Please choose a valid report date.' } });
    }
    if (date > todayInTimezone(process.env.APP_TIMEZONE)) {
      return response.status(400).json({ error: { code: 'FUTURE_DATE', message: 'Date cannot be in the future.' } });
    }
    let dates;
    try {
      dates = getReportRange(range, date);
    } catch {
      return response.status(400).json({ error: { code: 'INVALID_REPORT_RANGE', message: 'Choose a daily, month-to-date, or previous-month report.' } });
    }

    const [aggregateResult, dailyResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS count, MIN(value_mg_dl)::int AS lowest,
                MAX(value_mg_dl)::int AS highest, ROUND(AVG(value_mg_dl)::numeric, 1)::float8 AS average
         FROM readings WHERE user_id = $1 AND reading_date BETWEEN $2 AND $3`,
        [request.userId, dates.startDate, dates.endDate],
      ),
      range === 'daily'
        ? pool.query(
          `SELECT id, to_char(reading_date, 'YYYY-MM-DD') AS reading_date, time_slot, value_mg_dl
           FROM readings WHERE user_id = $1 AND reading_date = $2
           ORDER BY CASE time_slot
             WHEN 'morning_fasting' THEN 1
             WHEN 'after_breakfast' THEN 2
             WHEN 'after_lunch' THEN 3
             ELSE 4 END`,
          [request.userId, date],
        )
        : Promise.resolve({ rows: [] }),
    ]);

    const aggregate = aggregateResult.rows[0];
    const stats = {
      count: Number(aggregate.count),
      lowest: aggregate.lowest === null ? null : Number(aggregate.lowest),
      highest: aggregate.highest === null ? null : Number(aggregate.highest),
      average: aggregate.average === null ? null : Number(aggregate.average),
    };
    const readings = dailyResult.rows.map((row) => ({
      id: row.id,
      date: row.reading_date,
      slot: row.time_slot,
      slotLabel: SLOTS[row.time_slot],
      value: row.value_mg_dl,
    }));

    return response.json({
      report: {
        range,
        selectedDate: date,
        startDate: dates.startDate,
        endDate: dates.endDate,
        label: formatRange(dates.startDate, dates.endDate),
        ...stats,
        readings,
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
