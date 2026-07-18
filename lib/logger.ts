// D2: Lightweight structured logging helper.
// Emits JSON lines in production (machine-parseable for log aggregation) and
// human-friendly output in development. No external dependency required.

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogMeta {
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, meta?: LogMeta) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
  };

  if (process.env.NODE_ENV === 'production') {
    process.stdout.write(`${JSON.stringify(entry)}\n`);
    return;
  }

  const prefix = `[${level.toUpperCase()}]`;
  if (level === 'error') {
    console.error(prefix, message, meta ?? '');
  } else if (level === 'warn') {
    console.warn(prefix, message, meta ?? '');
  } else {
    console.log(prefix, message, meta ?? '');
  }
}

export const logger = {
  info: (message: string, meta?: LogMeta) => emit('info', message, meta),
  warn: (message: string, meta?: LogMeta) => emit('warn', message, meta),
  error: (message: string, meta?: LogMeta) => emit('error', message, meta),
  debug: (message: string, meta?: LogMeta) => {
    if (process.env.NODE_ENV !== 'production') {
      emit('debug', message, meta);
    }
  },
};
