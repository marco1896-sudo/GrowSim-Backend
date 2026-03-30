import app from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDb, disconnectDb } from './config/db.js';

let server;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info('shutdown_started', { signal });

  const timeout = setTimeout(() => {
    logger.fatal('shutdown_timeout_reached', { timeoutMs: env.shutdownTimeoutMs });
    process.exit(1);
  }, env.shutdownTimeoutMs);

  timeout.unref();

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }

    await disconnectDb();
    logger.info('shutdown_completed');
    process.exit(0);
  } catch (err) {
    logger.fatal('shutdown_failed', { error: err.message });
    process.exit(1);
  }
}

async function bootstrap() {
  await connectDb({ mongodbUri: env.mongodbUri });
  logger.info('db_connected');

  server = app.listen(env.port, () => {
    logger.info('server_listening', {
      service: env.serviceName,
      port: env.port,
      nodeEnv: env.nodeEnv
    });
  });

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled_rejection', { reason: String(reason) });
    shutdown('unhandledRejection');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal('uncaught_exception', { error: error.message, stack: error.stack });
    shutdown('uncaughtException');
  });
}

bootstrap().catch((err) => {
  logger.fatal('startup_failed', { error: err.message, stack: err.stack });
  process.exit(1);
});
