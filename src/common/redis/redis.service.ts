import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RedisClientType } from 'redis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly defaultTtl: number;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisClientType,
    private readonly configService: ConfigService,
  ) {
    this.defaultTtl = parseInt(
      this.configService.get<string>('REDIS_TTL', '300'),
      10,
    );
  }

  isAvailable(): boolean {
    try {
      return !!(this.redis && this.redis.isOpen && this.redis.isReady);
    } catch (error) {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) {
      return null;
    }
    try {
      const value = await this.redis.get(key);
      if (!value) {
        console.log('CACHE MISS');
        return null;
      }
      console.log('CACHE HIT');
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('REDIS ERROR');
      return null;
    }
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }
    try {
      const payload = JSON.stringify(value);
      const finalTtl = ttl !== undefined ? ttl : this.defaultTtl;

      if (finalTtl > 0) {
        await this.redis.set(key, payload, {
          EX: finalTtl,
        });
      } else {
        await this.redis.set(key, payload);
      }
      console.log('CACHE SET');
    } catch (error) {
      console.error('REDIS ERROR');
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }
    try {
      await this.redis.del(key);
      console.log('CACHE DELETE');
    } catch (error) {
      console.error('REDIS ERROR');
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }
    try {
      if (keys.length > 0) {
        await this.redis.del(keys);
        console.log('CACHE DELETE');
      }
    } catch (error) {
      console.error('REDIS ERROR');
    }
  }

  async deleteByPattern(pattern: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }
    try {
      const keys: string[] = [];
      for await (const key of this.redis.scanIterator({
        MATCH: pattern,
        COUNT: 100,
      })) {
        if (Array.isArray(key)) {
          keys.push(...key);
        } else {
          keys.push(key);
        }
      }
      if (keys.length > 0) {
        await this.deleteMany(keys);
      }
    } catch (error) {
      console.error('REDIS ERROR');
    }
  }

  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    try {
      const result = await this.redis.set(key, 'locked', {
        NX: true,
        PX: ttlMs,
      });
      return result === 'OK';
    } catch (error) {
      console.error('REDIS ERROR', error);
      return false;
    }
  }

  async releaseLock(key: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('REDIS ERROR', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('REDIS ERROR');
      return false;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }
    try {
      await this.redis.expire(key, ttl);
    } catch (error) {
      console.error('REDIS ERROR');
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.isAvailable()) {
      return -1;
    }
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      console.error('REDIS ERROR');
      return -1;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.isAvailable()) {
      return [];
    }
    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      console.error('REDIS ERROR');
      return [];
    }
  }

  async flush(): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }
    try {
      await this.redis.flushDb();
    } catch (error) {
      console.error('REDIS ERROR');
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.redis.isOpen) {
        await this.redis.quit();
      }
    } catch (error) {
      console.error('REDIS ERROR');
    }
  }
}
