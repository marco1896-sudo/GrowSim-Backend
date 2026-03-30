import { getDbState } from '../config/db.js';
import { env } from '../config/env.js';

export function getHealth(_req, res) {
  const db = getDbState();
  const healthy = db.status === 'connected';

  res.status(healthy ? 200 : 503).json({
    ok: healthy,
    service: env.serviceName,
    environment: env.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    db
  });
}
