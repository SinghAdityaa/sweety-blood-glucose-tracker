import test from 'node:test';
import assert from 'node:assert/strict';
import { getReportRange, isCalendarDate } from '../src/domain/dates.js';
import { summarizeReadings } from '../src/domain/reports.js';
import { validateReadingInput, ValidationError } from '../src/domain/validation.js';

test('accepts valid calendar dates and rejects impossible dates', () => {
  assert.equal(isCalendarDate('2026-02-28'), true);
  assert.equal(isCalendarDate('2026-02-30'), false);
});

test('computes month-to-date and previous calendar month ranges', () => {
  assert.deepEqual(getReportRange('mtd', '2026-10-15'), { startDate: '2026-10-01', endDate: '2026-10-15' });
  assert.deepEqual(getReportRange('monthly', '2026-01-03'), { startDate: '2025-12-01', endDate: '2025-12-31' });
});

test('validates whole-number glucose values and date/slot constraints', () => {
  assert.deepEqual(validateReadingInput({ value: '108', date: '2026-11-09', slot: 'morning_fasting' }, { today: '2026-11-09' }), {
    value: 108, date: '2026-11-09', slot: 'morning_fasting',
  });
  for (const input of [
    { value: '', date: '2026-11-09', slot: 'morning_fasting' },
    { value: 39, date: '2026-11-09', slot: 'morning_fasting' },
    { value: 108.5, date: '2026-11-09', slot: 'morning_fasting' },
    { value: 108, date: '2026-11-10', slot: 'morning_fasting' },
    { value: 108, date: '2026-11-09', slot: 'unknown' },
  ]) assert.throws(() => validateReadingInput(input, { today: '2026-11-09' }), ValidationError);
});

test('enforces unique slots and the four-reading daily cap', () => {
  assert.throws(() => validateReadingInput({ value: 100, date: '2026-11-09', slot: 'after_lunch' }, { today: '2026-11-09', existingCount: 2, existingSlots: ['after_lunch'] }), /already have an After lunch reading/);
  assert.throws(() => validateReadingInput({ value: 100, date: '2026-11-09', slot: 'morning_fasting' }, { today: '2026-11-09', existingCount: 1, existingSlots: ['morning_fasting'] }), /already have a Morning/);
  assert.throws(() => validateReadingInput({ value: 100, date: '2026-11-09', slot: 'after_dinner' }, { today: '2026-11-09', existingCount: 4, existingSlots: [] }), /only 4 readings/);
});

test('summarizes readings with a one-decimal average and friendly empty values', () => {
  assert.deepEqual(summarizeReadings([{ value: 100 }, { value: 111 }, { value: 120 }]), { count: 3, lowest: 100, highest: 120, average: 110.3 });
  assert.deepEqual(summarizeReadings([]), { count: 0, lowest: null, highest: null, average: null });
});
