import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { REDIS_CLIENT } from './redis.constants';

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],

  useFactory: async (
    configService: ConfigService,
  ): Promise<RedisClientType> => {
    const redisUrl = configService.get<string>('REDIS_URL');
    let client: RedisClientType;

    if (redisUrl) {
      client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 10000,
          reconnectStrategy: (retries) => {
            // Indefinite reconnection attempts to prevent ClientClosedError
            return Math.min(retries * 200, 5000);
          },
        },
      });
    } else {
      const host = configService.get<string>('REDIS_HOST') || 'localhost';
      const port = parseInt(
        configService.get<string>('REDIS_PORT', '6379'),
        10,
      );
      const password = configService.get<string>('REDIS_PASSWORD');
      const db = parseInt(configService.get<string>('REDIS_DB', '0'), 10);

      // Render or other cloud Redis instances might use TLS (e.g. port 6380 or rediss host)
      const isSecure =
        port === 6380 || host.includes('rediss') || host.includes('secure');

      client = createClient({
        socket: {
          host,
          port,
          connectTimeout: 10000,
          tls: isSecure ? ({} as any) : undefined,
          reconnectStrategy: (retries) => {
            // Indefinite reconnection attempts to prevent ClientClosedError
            return Math.min(retries * 200, 5000);
          },
        },
        password: password || undefined,
        database: db,
      });
    }

    client.on('ready', () => {
      console.log('Redis Connected');
    });

    client.on('reconnecting', () => {
      console.log('Redis Reconnecting');
    });

    client.on('end', () => {
      console.log('Redis Disconnected');
    });

    client.on('error', () => {
      console.error('Redis Error');
    });

    try {
      await client.connect();
    } catch (error) {
      console.error('Redis Connect Error:', error);
    }

    return client;
  },
};
