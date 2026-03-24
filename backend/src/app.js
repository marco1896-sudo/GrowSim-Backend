import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import saveRoutes from './routes/saveRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (env.corsOrigins.length === 0) return callback(null, true);
    if (env.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS blocked for this origin'));
  }
};
app.use(cors(corsOptions));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/save', saveRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
