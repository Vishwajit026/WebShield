import app from './app';
import config from './config/env';
import { logger } from './utils/logger';
import prisma from './lib/db';

const server = app.listen(config.port, () => {
  logger.info(`WebShield API running in ${config.nodeEnv} mode`);
  logger.info(`Listening on http://localhost:${config.port}`);
  logger.info(`Health check: http://localhost:${config.port}/api/health`);
});

// ── Graceful shutdown ────────────────────────────────────────────────────────

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — shutting down gracefully`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await prisma.$disconnect();
      logger.info('Database connection closed');
    } catch (err) {
      logger.error('Error disconnecting from database', err);
    }

    process.exit(0);
  });

  // Force exit after 10s if graceful shutdown stalls
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

// ── Unhandled error safety net ───────────────────────────────────────────────
// These handlers prevent the process from dying silently. In production,
// unhandled errors are logged but the process exits to avoid corrupted state.

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Promise rejection', reason instanceof Error ? reason : new Error(String(reason)));
  if (config.nodeEnv === 'production') {
    void gracefulShutdown('unhandledRejection');
  }
});

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception — process will exit', err);
  void gracefulShutdown('uncaughtException');
});
