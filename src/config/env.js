import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_SERVICE_NAME = 'growsim-backend';

function readString(name, options = {}) {
  const value = process.env[name];
  const trimmed = typeof value === 'string' ? value.trim() : '';

  if (!trimmed) {
    if (options.required) {
      throw new Error(`Missing required env var: ${name}`);
    }
    return options.defaultValue ?? '';
  }

  return trimmed;
}

function readNumber(name, options = {}) {
  const raw = readString(name, { required: options.required, defaultValue: String(options.defaultValue ?? '') });
  if (raw === '') return Number(options.defaultValue ?? 0);

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric env var ${name}: ${raw}`);
  }

  if (typeof options.min === 'number' && parsed < options.min) {
    throw new Error(`Env var ${name} must be >= ${options.min}`);
  }

  if (typeof options.max === 'number' && parsed > options.max) {
    throw new Error(`Env var ${name} must be <= ${options.max}`);
  }

  return parsed;
}

function readBoolean(name, defaultValue = false) {
  const raw = readString(name, { defaultValue: String(defaultValue) }).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  throw new Error(`Invalid boolean env var ${name}: ${raw}`);
}

function readList(name) {
  const raw = readString(name, { defaultValue: '' });
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function validateNodeEnv(value) {
  const allowed = ['development', 'test', 'production'];
  if (!allowed.includes(value)) {
    throw new Error(`Invalid NODE_ENV: ${value}. Allowed: ${allowed.join(', ')}`);
  }
  return value;
}

const nodeEnv = validateNodeEnv(readString('NODE_ENV', { defaultValue: 'development' }));
const jwtSecret = readString('JWT_SECRET', { required: true });

if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

export const env = {
  serviceName: readString('SERVICE_NAME', { defaultValue: DEFAULT_SERVICE_NAME }),
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: readNumber('PORT', { defaultValue: 8080, min: 1, max: 65535 }),
  logLevel: readString('LOG_LEVEL', { defaultValue: nodeEnv === 'production' ? 'info' : 'debug' }).toLowerCase(),
  bodyLimit: readString('BODY_LIMIT', { defaultValue: '2mb' }),
  trustProxy: readBoolean('TRUST_PROXY', nodeEnv === 'production'),
  jwtSecret,
  jwtExpiresIn: readString('JWT_EXPIRES_IN', { defaultValue: '7d' }),
  mongodbUri: readString('MONGODB_URI', { required: true }),
  corsOrigins: readList('CORS_ORIGINS'),
  corsAllowCredentials: readBoolean('CORS_ALLOW_CREDENTIALS', false),
  shutdownTimeoutMs: readNumber('SHUTDOWN_TIMEOUT_MS', { defaultValue: 10000, min: 1000, max: 120000 })
};
