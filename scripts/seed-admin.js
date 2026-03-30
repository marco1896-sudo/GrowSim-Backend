import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { User } from '../src/models/User.js';

function requiredEnv(name) {
  const value = (process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function run() {
  const email = requiredEnv('ADMIN_SEED_EMAIL').toLowerCase();
  const password = requiredEnv('ADMIN_SEED_PASSWORD');
  const displayName = (process.env.ADMIN_SEED_DISPLAY_NAME || 'Admin').trim();

  if (password.length < 8) {
    throw new Error('ADMIN_SEED_PASSWORD must be at least 8 characters long');
  }

  await connectDb({ mongodbUri: env.mongodbUri });

  const existing = await User.findOne({ email });
  if (existing) {
    existing.role = 'admin';
    existing.isBanned = false;
    if (displayName) existing.displayName = displayName;
    await existing.save();
    console.log(`Updated existing user as admin: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({
    email,
    passwordHash,
    displayName,
    role: 'admin',
    isBanned: false,
    badges: ['Admin']
  });

  console.log(`Created admin user: ${email}`);
}

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb();
  });
