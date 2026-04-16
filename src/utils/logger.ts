type LogLevel = 'info' | 'warn' | 'error';

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  info: (message: string): void => {
    console.info(formatMessage('info', message));
  },
  warn: (message: string): void => {
    console.warn(formatMessage('warn', message));
  },
  error: (message: string, error?: unknown): void => {
    const errorDetail = error instanceof Error ? ` — ${error.message}` : '';
    console.error(formatMessage('error', `${message}${errorDetail}`));
  },
};
