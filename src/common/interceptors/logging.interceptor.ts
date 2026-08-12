import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { logger } from '../../database/logger';
import { requestContext } from '../cache/request-context';
import { sanitizeLogData } from '../utils/log-sanitizer.util';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<any>();
    const response = httpContext.getResponse<any>();

    const controllerName = context.getClass().name;
    const functionName = context.getHandler().name;
    const method = request?.method ?? 'UNKNOWN';
    const path = request?.path ?? request?.url ?? 'unknown';
    const reqIdHeader = request?.headers?.['x-request-id'];
    const reqId =
      (Array.isArray(reqIdHeader) ? reqIdHeader[0] : reqIdHeader) ||
      `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    request.reqId = reqId;

    // Attach authenticated user ID to requestContext store if present
    const store = requestContext.getStore();
    if (store && request?.user?.id) {
      (store as any).userId = request.user.id;
    }

    const startTime = performance.now();

    logger.info('Incoming request', {
      reqId,
      controller: controllerName,
      functionName,
      route: path,
      reqBody: sanitizeLogData(request?.body),
      msg: `${method} ${path} started`,
    });

    return next.handle().pipe(
      tap((data) => {
        const responseTime = `${(performance.now() - startTime).toFixed(2)}ms`;
        const statusCode = response?.statusCode ?? 200;
        logger.info('Request completed', {
          reqId,
          controller: controllerName,
          functionName,
          route: path,
          statusCode,
          responseTime,
          data: sanitizeLogData(data),
          msg: `${method} ${path} completed`,
        });
      }),
      catchError((error) => {
        const responseTime = `${(performance.now() - startTime).toFixed(2)}ms`;
        const statusCode = error?.status ?? response?.statusCode ?? 500;
        const errorId = `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        logger.error('Request failed', {
          reqId,
          controller: controllerName,
          functionName,
          route: path,
          statusCode,
          responseTime,
          errorId,
          data: {
            status: statusCode,
            message: error?.message ?? 'Unknown error',
          },
          msg: `${method} ${path} failed`,
        });

        if (error && typeof error === 'object') {
          (error as any).errorId = errorId;
        }

        return throwError(() => error);
      }),
    );
  }
}
