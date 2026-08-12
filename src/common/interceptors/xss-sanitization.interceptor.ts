import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

function sanitizeString(val: string): string {
  if (!val || typeof val !== 'string') {
    return val;
  }
  // Strip out actual HTML tags recursively to prevent HTML/Script injection,
  // but preserve mathematical operators and other safe uses of '<' and '>'
  let prev;
  let clean = val;
  const htmlTagPattern = /<[a-zA-Z/!][^>]*>/g;
  do {
    prev = clean;
    clean = clean.replace(htmlTagPattern, '');
  } while (clean !== prev);
  return clean;
}

function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key of Object.keys(obj)) {
      sanitized[key] = sanitizeObject(obj[key]);
    }
    return sanitized;
  }
  return obj;
}

@Injectable()
export class XssSanitizationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    if (request && request.body) {
      request.body = sanitizeObject(request.body);
    }
    if (request && request.query) {
      const sanitizedQuery = sanitizeObject(request.query);
      for (const key of Object.keys(request.query)) {
        delete request.query[key];
      }
      Object.assign(request.query, sanitizedQuery);
    }
    if (request && request.params) {
      const sanitizedParams = sanitizeObject(request.params);
      for (const key of Object.keys(request.params)) {
        delete request.params[key];
      }
      Object.assign(request.params, sanitizedParams);
    }
    return next.handle();
  }
}
