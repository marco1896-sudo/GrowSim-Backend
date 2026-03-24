export function httpError(status, message, details = null) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}
