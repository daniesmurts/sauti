type LogMeta = Record<string, unknown> | undefined;

function stringifyMeta(meta: LogMeta): string {
  if (!meta) {
    return '';
  }

  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return '';
  }
}

export const logger = {
  info(message: string, meta?: LogMeta): void {
    console.info(`[Sauti] ${message}${stringifyMeta(meta)}`);
  },
  warn(message: string, meta?: LogMeta): void {
    console.warn(`[Sauti] ${message}${stringifyMeta(meta)}`);
  },
  error(message: string, meta?: LogMeta): void {
    console.error(`[Sauti] ${message}${stringifyMeta(meta)}`);
  },
};