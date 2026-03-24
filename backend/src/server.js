import app from './app.js';
import { env } from './config/env.js';
import { connectDb } from './config/db.js';

async function bootstrap() {
  await connectDb({ mongodbUri: env.mongodbUri, useInMemoryDb: env.useInMemoryDb });
  app.listen(env.port, () => {
    console.log(`[growsim-backend] listening on :${env.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('[growsim-backend] fatal startup error', err);
  process.exit(1);
});
