import { MAX_READINGS_PER_DAY, SLOT_KEYS, SLOTS } from './constants.js';
import { isCalendarDate } from './dates.js';

export class ValidationError extends Error {
  constructor(message, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
  }
}

export function validateReadingInput(input, { today, existingCount = 0, existingSlots = [] } = {}) {
  const rawValue = input?.value;
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
    throw new ValidationError('Please enter a glucose value.', 'VALUE_REQUIRED');
  }

  const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isInteger(value) || value < 40 || value > 600) {
    throw new ValidationError('Value must be between 40 and 600 mg/dl.', 'VALUE_OUT_OF_RANGE');
  }

  const date = input?.date;
  if (!date) throw new ValidationError('Please choose a date.', 'DATE_REQUIRED');
  if (!isCalendarDate(date)) throw new ValidationError('Please choose a valid date.', 'INVALID_DATE');
  if (today && date > today) throw new ValidationError('Date cannot be in the future.', 'FUTURE_DATE');

  const slot = input?.slot;
  if (!SLOT_KEYS.includes(slot)) throw new ValidationError('Please choose a valid time slot.', 'INVALID_SLOT');

  if (existingCount >= MAX_READINGS_PER_DAY) {
    throw new ValidationError('You can add only 4 readings per day.', 'DAILY_LIMIT_REACHED');
  }
  if (existingSlots.includes(slot)) {
    const article = /^[aeiou]/i.test(SLOTS[slot]) ? 'an' : 'a';
    throw new ValidationError(`You already have ${article} ${SLOTS[slot]} reading for this date.`, 'DUPLICATE_SLOT');
  }

  return { date, slot, value };
}

export function validateAuthInput({ name, email, password }, { registering = false } = {}) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (registering && (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 80)) {
    throw new ValidationError('Please enter your name (up to 80 characters).', 'INVALID_NAME');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new ValidationError('Please enter a valid email address.', 'INVALID_EMAIL');
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new ValidationError('Password must be between 8 and 128 characters.', 'INVALID_PASSWORD');
  }
  return { name: registering ? name.trim() : undefined, email: normalizedEmail, password };
}
