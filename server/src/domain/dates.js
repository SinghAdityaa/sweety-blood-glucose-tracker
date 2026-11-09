const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function todayInTimezone(timeZone = 'Asia/Kolkata', now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getReportRange(range, selectedDate) {
  if (!isCalendarDate(selectedDate)) throw new Error('Please choose a valid report date.');
  const [year, month, day] = selectedDate.split('-').map(Number);
  if (range === 'daily') return { startDate: selectedDate, endDate: selectedDate };
  if (range === 'mtd') {
    return { startDate: `${year}-${String(month).padStart(2, '0')}-01`, endDate: selectedDate };
  }
  if (range === 'monthly') {
    const start = new Date(Date.UTC(year, month - 2, 1));
    const end = new Date(Date.UTC(year, month - 1, 0));
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }
  throw new Error('Choose a daily, month-to-date, or previous-month report.');
}

export function formatRange(startDate, endDate) {
  const format = (value) => new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
  if (startDate === endDate) return format(startDate);
  const startYear = startDate.slice(0, 4);
  const endYear = endDate.slice(0, 4);
  if (startYear === endYear && startDate.slice(5, 7) === endDate.slice(5, 7)) {
    const start = format(startDate).replace(` ${startYear}`, '');
    return `${start}–${format(endDate)}`;
  }
  return `${format(startDate)} – ${format(endDate)}`;
}
