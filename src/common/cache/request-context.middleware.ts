import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { requestContext } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const reqIdHeader = req.headers['x-request-id'];
    const reqId =
      (Array.isArray(reqIdHeader) ? reqIdHeader[0] : reqIdHeader) ||
      `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    req['reqId'] = reqId;
    const apiName = `${req.method} ${req.originalUrl || req.url}`;
    req['apiName'] = apiName;

    requestContext.run({ reqId, apiName }, () => {
      next();
    });
  }
}
