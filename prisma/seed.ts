import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../apps/api/src/utils/password';

// Load .env from root and local
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const devPassword = process.env.DEV_ADMIN_PASSWORD;

  if (!devPassword) {
    console.warn(
      '[seed] DEV_ADMIN_PASSWORD environment variable is not set.\n' +
      '[seed] Skipping admin account creation to avoid predictable credentials.\n' +
      '[seed] Set DEV_ADMIN_PASSWORD in your .env file to create a dev admin.'
    );
    return;
  }

  if (devPassword.length < 12) {
    console.error('[seed] DEV_ADMIN_PASSWORD must be at least 12 characters.');
    process.exit(1);
  }

  const normalizedEmail = 'dev-admin@webshield.local';

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existing) {
    console.log(`[seed] Dev admin already exists (id: ${existing.id}). Skipping.`);
    return;
  }

  const passwordHash = await hashPassword(devPassword);

  const admin = await prisma.user.create({
    data: {
      name: '[DEV] Admin',
      email: normalizedEmail,
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log(`[seed] ✅ Created dev admin account (id: ${admin.id})`);
  console.log('[seed] ⚠️  This account is for DEVELOPMENT ONLY. Never deploy to production.');
}

main()
  .catch(err => {
    console.error('[seed] Fatal error:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
