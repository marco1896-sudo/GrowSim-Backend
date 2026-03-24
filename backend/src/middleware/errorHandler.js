export function notFoundHandler(_req, res) {
  return res.status(404).json({ error: 'Not found' });
}

export function errorHandler(err, _req, res, _next) {
  const status = Number(err?.status) || 500;
  const message = err?.message || 'Internal server error';

  const payload = { error: message };
  if (err?.details) payload.details = err.details;

  return res.status(status).json(payload);
}
