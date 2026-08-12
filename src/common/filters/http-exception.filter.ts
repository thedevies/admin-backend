import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { logger } from '../../database/logger';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: any = 'Internal server error';
    let error = 'Internal Server Error';

    const reqId = (request as any).reqId ?? 'N/A';
    const errorId =
      (exception as any)?.errorId ??
      `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // Log the actual error internally with stack trace for troubleshooting
    logger.error('Unhandled exception occurred', {
      reqId,
      errorId,
      data: {
        path: request.url,
        method: request.method,
        error:
          exception instanceof Error
            ? {
                message: exception.message,
                stack: exception.stack,
              }
            : String(exception),
      },
    });

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        message = (res as any).message || exception.message;
        error = (res as any).error || exception.name;
      } else {
        message = exception.message;
      }
    } else {
      // Hide Prisma errors / raw database errors / general application crashes
      const errorStr = String(exception);
      if (
        errorStr.includes('Prisma') ||
        errorStr.includes('database') ||
        errorStr.includes('postgres') ||
        errorStr.includes('SQL')
      ) {
        message = 'A database error occurred. Please try again later.';
        error = 'DatabaseError';
      }
    }

    // Sanitize any accidental filesystem paths (e.g., /home/...) from error messages
    const pathRegex = /\/[a-zA-Z0-9_\-\.\/]+/g;
    if (typeof message === 'string') {
      message = message.replace(pathRegex, '[PATH]');
    } else if (Array.isArray(message)) {
      message = message.map((msg) =>
        typeof msg === 'string' ? msg.replace(pathRegex, '[PATH]') : msg,
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
