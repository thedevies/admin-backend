import { AsyncLocalStorage } from 'async_hooks';

export interface TransactionStore {
  invalidationQueue: Array<() => Promise<void> | void>;
}

export const transactionContext = new AsyncLocalStorage<TransactionStore>();
