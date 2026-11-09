export function summarizeReadings(readings) {
  const values = readings.map((reading) => Number(reading.value ?? reading.value_mg_dl));
  if (values.length === 0) return { count: 0, highest: null, lowest: null, average: null };
  const sum = values.reduce((total, value) => total + value, 0);
  return {
    count: values.length,
    highest: Math.max(...values),
    lowest: Math.min(...values),
    average: Number((sum / values.length).toFixed(1)),
  };
}
