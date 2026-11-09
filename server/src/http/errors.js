export function errorHandler(error, _request, response, _next) {
  if (response.headersSent) return;
  if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(error.code)) {
    return response.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'The database is not running. Start PostgreSQL, then try again.' } });
  }
  if (error.code === '23505') {
    return response.status(409).json({ error: { code: 'DUPLICATE_SLOT', message: 'A reading already exists for this time slot and date.' } });
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return response.status(400).json({ error: { code: 'INVALID_JSON', message: 'Please send valid JSON.' } });
  }
  console.error(error);
  return response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
}

export function notFound(_request, response) {
  return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'That page or record was not found.' } });
}
