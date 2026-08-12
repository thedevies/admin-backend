import { sanitizeLogData } from '../common/utils/log-sanitizer.util';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LoggerContext {
  reqId?: string;
  controller?: string;
  functionName?: string;
  reqBody?: unknown;
  data?: unknown;
  msg?: string;
  route?: string;
  statusCode?: number;
  responseTime?: string;
  errorId?: string;
  [key: string]: any;
}

export class AppLogger {
  private readonly defaultContext: Record<string, unknown>;

  constructor(defaultContext: Record<string, unknown> = {}) {
    this.defaultContext = defaultContext;
  }

  info(message: string, context?: LoggerContext): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: LoggerContext): void {
    this.write('warn', message, context);
  }

  error(message: string, context?: LoggerContext): void {
    this.write('error', message, context);
  }

  debug(message: string, context?: LoggerContext): void {
    this.write('debug', message, context);
  }

  private write(
    level: LogLevel,
    message: string,
    context?: LoggerContext,
  ): void {
    if (level === 'debug') {
      const isProduction = process.env.NODE_ENV === 'production';
      const forceDebug = process.env.LOG_LEVEL === 'debug';
      if (isProduction && !forceDebug) {
        return;
      }
    }

    const sanitizedContext = context ? sanitizeLogData(context) : undefined;
    const sanitizedDefault = this.defaultContext
      ? sanitizeLogData(this.defaultContext)
      : {};

    const payload = {
      timestamp: new Date().toISOString(),
      level,
      ...sanitizedDefault,
      ...sanitizedContext,
      msg: sanitizedContext?.msg ?? message,
    };

    const serializedPayload = JSON.stringify(payload);

    switch (level) {
      case 'info':
        console.info(serializedPayload);
        break;
      case 'warn':
        console.warn(serializedPayload);
        break;
      case 'error':
        console.error(serializedPayload);
        break;
      case 'debug':
        console.debug(serializedPayload);
        break;
      default:
        console.log(serializedPayload);
    }
  }
}

export const logger = new AppLogger();

export const logInfo = (message: string, context?: LoggerContext): void => {
  logger.info(message, context);
};

export const logWarn = (message: string, context?: LoggerContext): void => {
  logger.warn(message, context);
};

export const logError = (message: string, context?: LoggerContext): void => {
  logger.error(message, context);
};

export const logDebug = (message: string, context?: LoggerContext): void => {
  logger.debug(message, context);
};
