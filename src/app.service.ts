import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './common/redis/redis.service';
import { StorageService } from './common/storage/storage.service';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly storageService: StorageService,
  ) {}

  async healthCheck() {
    let postgresHealthy = false;
    let redisHealthy = false;
    let storageHealthy = false;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      postgresHealthy = true;
    } catch (error) {
      postgresHealthy = false;
    }

    try {
      redisHealthy = this.redisService.isAvailable();
    } catch (error) {
      redisHealthy = false;
    }

    try {
      storageHealthy = !!this.storageService;
    } catch (error) {
      storageHealthy = false;
    }

    const healthy = postgresHealthy && redisHealthy && storageHealthy;
    const memoryUsage = process.memoryUsage();

    return {
      status: healthy ? 'healthy' : 'unhealthy',
      postgres: postgresHealthy ? 'healthy' : 'unhealthy',
      redis: redisHealthy ? 'healthy' : 'unhealthy',
      storage: storageHealthy ? 'healthy' : 'unhealthy',
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      },
      uptime: `${Math.round(process.uptime())}s`,
      version: '0.0.1',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    };
  }
}
