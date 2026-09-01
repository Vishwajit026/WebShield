import config from '../config/env';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  info: (message: string) => {
    console.log(formatMessage('info', message));
  },
  warn: (message: string) => {
    console.warn(formatMessage('warn', message));
  },
  error: (message: string, error?: unknown) => {
    console.error(formatMessage('error', message));
    if (error instanceof Error && config.nodeEnv !== 'production') {
      console.error(error.stack);
    }
  },
  debug: (message: string) => {
    if (config.nodeEnv === 'development') {
      console.debug(formatMessage('debug', message));
    }
  },
};
