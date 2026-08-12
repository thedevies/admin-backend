import { AsyncLocalStorage } from 'async_hooks';

export interface RequestStore {
  reqId: string;
  apiName: string;
  userId?: number;
}

export const requestContext = new AsyncLocalStorage<RequestStore>();
