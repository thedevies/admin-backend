import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { requestContext } from './request-context';
import { logger } from '../../database/logger';

export interface CacheOptions {
  ttl?: number; // in seconds
  lockTtlMs?: number;
  retryIntervalMs?: number;
  maxRetries?: number;
  staleWhileRevalidate?: boolean;
  backgroundRefresh?: boolean;
  shouldCache?: (result: any) => boolean;
}

@Injectable()
export class CacheService {
  constructor(private readonly redisService: RedisService) {}

  private logOperation(
    operation:
      | 'CACHE HIT'
      | 'CACHE MISS'
      | 'CACHE SET'
      | 'CACHE UPDATE'
      | 'CACHE DELETE'
      | 'CACHE DELETE PATTERN'
      | 'CACHE REFRESH'
      | 'CACHE LOCK ACQUIRED'
      | 'CACHE LOCK WAIT'
      | 'CACHE LOCK RELEASED'
      | 'CACHE FALLBACK'
      | 'CACHE ERROR',
    key: string,
    startTime: number,
  ) {
    const elapsed = `${(performance.now() - startTime).toFixed(2)}ms`;
    const store = requestContext.getStore();
    const reqId = store?.reqId ?? 'N/A';
    const apiName = store?.apiName ?? 'N/A';

    const logPayload = {
      reqId,
      controller: 'CacheService',
      functionName: operation.toLowerCase().replace(/ /g, '_'),
      data: {
        cacheKey: key,
        executionTime: elapsed,
        apiName,
      },
      msg: `${operation} - Key: ${key} - Time: ${elapsed} - API: ${apiName}`,
    };

    if (operation === 'CACHE ERROR') {
      logger.error(operation, logPayload);
    } else if (operation === 'CACHE FALLBACK') {
      logger.warn(operation, logPayload);
    } else {
      logger.info(operation, logPayload);
    }
  }

  private getJitterTtl(ttlSeconds: number): number {
    if (!ttlSeconds || ttlSeconds <= 0) return ttlSeconds;
    // Add ±10% jitter to prevent mass expiration stampedes
    const minJitter = -0.1;
    const maxJitter = 0.1;
    const jitterPercent = minJitter + Math.random() * (maxJitter - minJitter);
    const jitter = Math.round(ttlSeconds * jitterPercent);
    return Math.max(1, ttlSeconds + jitter);
  }

  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now();
    try {
      const value = await this.redisService.get<T>(key);
      if (value === null || value === undefined) {
        this.logOperation('CACHE MISS', key, startTime);
        return null;
      }
      this.logOperation('CACHE HIT', key, startTime);
      return value;
    } catch (error) {
      this.logOperation('CACHE ERROR', key, startTime);
      logger.error('Cache GET failed', {
        controller: 'CacheService',
        functionName: 'get',
        data: {
          error: error instanceof Error ? error.message : String(error),
          cacheKey: key,
        },
      });
      return null;
    }
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const startTime = performance.now();
    try {
      const jitteredTtl =
        ttl !== undefined ? this.getJitterTtl(ttl) : undefined;
      await this.redisService.set(key, value, jitteredTtl);
      this.logOperation('CACHE SET', key, startTime);
    } catch (error) {
      this.logOperation('CACHE ERROR', key, startTime);
      logger.error('Cache SET failed', {
        controller: 'CacheService',
        functionName: 'set',
        data: {
          error: error instanceof Error ? error.message : String(error),
          cacheKey: key,
        },
      });
    }
  }

  async delete(key: string): Promise<void> {
    const startTime = performance.now();
    try {
      await this.redisService.delete(key);
      this.logOperation('CACHE DELETE', key, startTime);
    } catch (error) {
      this.logOperation('CACHE ERROR', key, startTime);
      logger.error('Cache DELETE failed', {
        controller: 'CacheService',
        functionName: 'delete',
        data: {
          error: error instanceof Error ? error.message : String(error),
          cacheKey: key,
        },
      });
    }
  }

  async deleteByPattern(pattern: string): Promise<void> {
    const startTime = performance.now();
    try {
      await this.redisService.deleteByPattern(pattern);
      this.logOperation('CACHE DELETE PATTERN', pattern, startTime);
    } catch (error) {
      this.logOperation('CACHE ERROR', pattern, startTime);
      logger.error('Cache DELETE PATTERN failed', {
        controller: 'CacheService',
        functionName: 'deleteByPattern',
        data: {
          error: error instanceof Error ? error.message : String(error),
          pattern,
        },
      });
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      return await this.redisService.exists(key);
    } catch (error) {
      logger.error('Cache EXISTS failed', {
        controller: 'CacheService',
        functionName: 'exists',
        data: {
          error: error instanceof Error ? error.message : String(error),
          cacheKey: key,
        },
      });
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.redisService.ttl(key);
    } catch (error) {
      logger.error('Cache TTL failed', {
        controller: 'CacheService',
        functionName: 'ttl',
        data: {
          error: error instanceof Error ? error.message : String(error),
          cacheKey: key,
        },
      });
      return -1;
    }
  }

  /**
   * Safe Cache-Aside wrapper with Distributed Lock (Single Flight),
   * TTL Jitter, background revalidation (Stale-While-Revalidate), and graceful database fallback.
   */
  async getOrSet<T>(
    key: string,
    dbQuery: () => Promise<T>,
    options: CacheOptions = {},
  ): Promise<T> {
    const startTime = performance.now();
    const ttl = options.ttl;

    // 0. Quick check: Is Redis available? If not, fallback immediately
    if (!this.redisService.isAvailable()) {
      this.logOperation('CACHE FALLBACK', key, startTime);
      return await dbQuery();
    }

    // 1. Try to fetch from Redis
    try {
      const cached = await this.redisService.get<T>(key);
      if (cached !== null && cached !== undefined) {
        this.logOperation('CACHE HIT', key, startTime);

        // Async Background Revalidation (Stale-While-Revalidate)
        if (options.staleWhileRevalidate || options.backgroundRefresh) {
          this.triggerBackgroundRefresh(key, dbQuery, options).catch((err) => {
            logger.error('Background revalidation failed', {
              controller: 'CacheService',
              functionName: 'triggerBackgroundRefresh',
              data: {
                error: err instanceof Error ? err.message : String(err),
                cacheKey: key,
              },
            });
          });
        }

        return cached;
      }
    } catch (error) {
      this.logOperation('CACHE FALLBACK', key, startTime);
      logger.error(
        'Cache read error in getOrSet, falling back directly to DB',
        {
          controller: 'CacheService',
          functionName: 'getOrSet',
          data: {
            error: error instanceof Error ? error.message : String(error),
            cacheKey: key,
          },
        },
      );
      return await dbQuery();
    }

    // 2. Cache Miss - Acquire Lock to prevent Cache Stampede
    this.logOperation('CACHE MISS', key, startTime);

    const lockKey = `lock:${key}`;
    const lockTtlMs = options.lockTtlMs ?? 5000;
    const retryIntervalMs = options.retryIntervalMs ?? 50;
    const maxRetries = options.maxRetries ?? 20; // 20 * 50ms = 1s max waiting time

    let isLocked = false;
    try {
      isLocked = await this.redisService.acquireLock(lockKey, lockTtlMs);
    } catch (error) {
      logger.error(
        'Lock acquisition failed due to error, falling back directly to DB',
        {
          controller: 'CacheService',
          functionName: 'getOrSet',
          data: {
            error: error instanceof Error ? error.message : String(error),
            cacheKey: key,
          },
        },
      );
      this.logOperation('CACHE FALLBACK', key, startTime);
      return await dbQuery();
    }

    if (isLocked) {
      this.logOperation('CACHE LOCK ACQUIRED', lockKey, startTime);
      try {
        const result = await dbQuery();
        let doCache = true;
        if (options.shouldCache) {
          doCache = options.shouldCache(result);
        }
        if (doCache) {
          const jitteredTtl =
            ttl !== undefined ? this.getJitterTtl(ttl) : undefined;
          await this.redisService.set(key, result, jitteredTtl);
          this.logOperation('CACHE SET', key, startTime);
        }
        return result;
      } finally {
        await this.redisService.releaseLock(lockKey);
        this.logOperation('CACHE LOCK RELEASED', lockKey, startTime);
      }
    } else {
      // 3. Lock held by another process. Wait and retry (Single Flight)
      this.logOperation('CACHE LOCK WAIT', lockKey, startTime);
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (!this.redisService.isAvailable()) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
        try {
          const cached = await this.redisService.get<T>(key);
          if (cached !== null && cached !== undefined) {
            this.logOperation('CACHE HIT', key, startTime);
            return cached;
          }
        } catch (error) {
          // Break loop and query DB directly if Redis encounters failure during wait
          break;
        }
      }

      // Max retries exceeded or Redis error, fallback directly
      this.logOperation('CACHE FALLBACK', key, startTime);
      logger.warn(
        'Lock wait timeout or Redis error during poll, falling back directly to DB',
        {
          controller: 'CacheService',
          functionName: 'getOrSet',
          data: { cacheKey: key },
        },
      );
      return await dbQuery();
    }
  }

  /**
   * Refreshes list/pagination caches in memory to avoid full DB queries
   */
  async refreshListCaches(
    pattern: string,
    updateFn: (item: any) => any | null,
  ): Promise<void> {
    try {
      const keys = await this.redisService.keys(pattern);
      for (const key of keys) {
        const cached = await this.redisService.get<any>(key);
        if (cached && (Array.isArray(cached) || Array.isArray(cached.data))) {
          let modified = false;
          const dataList = Array.isArray(cached) ? cached : cached.data;

          const updatedList = dataList
            .map((item: any) => {
              const updated = updateFn(item);
              if (updated !== item) {
                modified = true;
              }
              return updated;
            })
            .filter(Boolean);

          if (modified) {
            const ttl = await this.redisService.ttl(key);
            if (Array.isArray(cached)) {
              await this.redisService.set(
                key,
                updatedList,
                ttl > 0 ? ttl : undefined,
              );
            } else {
              cached.data = updatedList;
              if (updatedList.length < dataList.length && cached.pagination) {
                cached.pagination.total = Math.max(
                  0,
                  (cached.pagination.total || 0) -
                    (dataList.length - updatedList.length),
                );
              }
              await this.redisService.set(
                key,
                cached,
                ttl > 0 ? ttl : undefined,
              );
            }
            this.logOperation('CACHE UPDATE', key, performance.now());
          }
        }
      }
    } catch (error) {
      logger.error('Failed to refresh list caches', {
        controller: 'CacheService',
        functionName: 'refreshListCaches',
        data: {
          error: error instanceof Error ? error.message : String(error),
          pattern,
        },
      });
    }
  }

  private async triggerBackgroundRefresh<T>(
    key: string,
    dbQuery: () => Promise<T>,
    options: CacheOptions = {},
  ): Promise<void> {
    try {
      const remainingTtl = await this.redisService.ttl(key);
      if (remainingTtl < 0) return;

      const ttlSeconds = options.ttl;
      const originalTtl = ttlSeconds ?? 300;
      // Revalidate if remaining TTL is less than 30% of original TTL or less than 60 seconds
      const threshold = Math.min(60, originalTtl * 0.3);

      if (remainingTtl <= threshold) {
        const revalLockKey = `lock:revalidate:${key}`;
        const isLocked = await this.redisService.acquireLock(
          revalLockKey,
          15000,
        );

        if (isLocked) {
          const startTime = performance.now();
          // Fire-and-forget revalidation in background
          (async () => {
            try {
              const result = await dbQuery();
              let doCache = true;
              if (options.shouldCache) {
                doCache = options.shouldCache(result);
              }
              if (doCache) {
                const jitteredTtl =
                  ttlSeconds !== undefined
                    ? this.getJitterTtl(ttlSeconds)
                    : undefined;
                await this.redisService.set(key, result, jitteredTtl);
                this.logOperation('CACHE REFRESH', key, startTime);
              }
            } catch (err) {
              logger.error(
                'Failed background revalidation DB query or cache update',
                {
                  controller: 'CacheService',
                  data: {
                    error: err instanceof Error ? err.message : String(err),
                    cacheKey: key,
                  },
                },
              );
            } finally {
              await this.redisService.releaseLock(revalLockKey);
            }
          })();
        }
      }
    } catch (error) {
      // Gracefully ignore error in revalidation triggering to preserve high performance
    }
  }
}
