export function httpError(status, message, details = null, code = null) {
  const err = new Error(message);
  err.status = status;

  if (details) {
    err.details = details;
  }

  if (code) {
    err.code = code;
  }

  return err;
}
