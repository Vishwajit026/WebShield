import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Singleton pattern — prevents multiple Prisma instances in development
// (hot-reload creates new module instances)
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  logger.info('Disconnecting Prisma client');
  await prisma.$disconnect();
});

export default prisma;
