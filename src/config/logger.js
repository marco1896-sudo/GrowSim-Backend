const levels = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50
};

const configuredLevel = process.env.LOG_LEVEL?.toLowerCase() || 'info';
const minLevel = levels[configuredLevel] ?? levels.info;

function canLog(level) {
  return (levels[level] ?? 100) >= minLevel;
}

function write(level, message, meta = null) {
  if (!canLog(level)) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    message
  };

  if (meta && typeof meta === 'object' && Object.keys(meta).length > 0) {
    entry.meta = meta;
  }

  const line = JSON.stringify(entry);

  if (level === 'error' || level === 'fatal') {
    process.stderr.write(`${line}\n`);
    return;
  }

  process.stdout.write(`${line}\n`);
}

export const logger = {
  debug: (message, meta) => write('debug', message, meta),
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  fatal: (message, meta) => write('fatal', message, meta)
};
