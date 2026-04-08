import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import { env } from './config/env.js';
import { logger } from './config/logger.js';
import authRoutes from './routes/authRoutes.js';
import saveRoutes from './routes/saveRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import v1Routes from './routes/v1Routes.js';
import { requestContext } from './middleware/requestContext.js';
import { applyPwaEntryCachePolicy, applyStaticCachePolicy } from './middleware/cachePolicy.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (env.trustProxy) {
  app.set('trust proxy', 1);
}

app.use(requestContext);
app.use(helmet());
app.use(express.json({ limit: env.bodyLimit }));

morgan.token('request-id', (req) => req.requestId || '-');
morgan.token('real-ip', (req) => req.ip || '-');

app.use(
  morgan(env.isProduction ? 'combined' : ':method :url :status :response-time ms req_id=:request-id ip=:real-ip', {
    stream: {
      write(line) {
        logger.info('http_request', { line: line.trim() });
      }
    }
  })
);

function isOriginAllowed(origin) {
  if (!origin) return true;

  if (env.corsOrigins.length === 0) {
    return !env.isProduction;
  }

  return env.corsOrigins.includes(origin);
}

const corsOptionsDelegate = (req, callback) => {
  const origin = req.header('Origin');

  if (isOriginAllowed(origin)) {
    callback(null, {
      origin: origin || true,
      credentials: env.corsAllowCredentials
    });
    return;
  }

  callback(null, { origin: false });
};

app.use(cors(corsOptionsDelegate));
app.use(applyPwaEntryCachePolicy);

const staticMiddlewareOptions = {
  setHeaders(res, filePath) {
    applyStaticCachePolicy(res, filePath);
  }
};

app.use('/static', express.static(path.join(__dirname, 'public'), staticMiddlewareOptions));
app.use('/admin-static', express.static(path.join(__dirname, 'public'), staticMiddlewareOptions));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/save', saveRoutes);
app.use('/api/v1', v1Routes);
app.use('/admin', adminRoutes);

app.get('/', (_req, res) => {
  res.json({ ok: true, service: env.serviceName });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
