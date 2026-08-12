import {
  Injectable,
  INestApplication,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { CacheService } from '../common/cache/cache.service';
import { requestContext } from '../common/cache/request-context';
import { transactionContext } from './transaction-context';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly extendedClient: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    super({
      datasources: {
        db: {
          url: (() => {
            let dbUrl = configService.get<string>('DATABASE_URL') || '';
            if (dbUrl) {
              try {
                const parsedUrl = new URL(dbUrl);
                const connectionLimit = configService.get<string>(
                  'PRISMA_CONNECTION_LIMIT',
                );
                const connectTimeout = configService.get<string>(
                  'PRISMA_CONNECT_TIMEOUT',
                );
                const poolTimeout = configService.get<string>(
                  'PRISMA_POOL_TIMEOUT',
                );
                const socketTimeout = configService.get<string>(
                  'PRISMA_SOCKET_TIMEOUT',
                );

                if (connectionLimit) {
                  parsedUrl.searchParams.set(
                    'connection_limit',
                    connectionLimit,
                  );
                }
                if (connectTimeout) {
                  parsedUrl.searchParams.set('connect_timeout', connectTimeout);
                }
                if (poolTimeout) {
                  parsedUrl.searchParams.set('pool_timeout', poolTimeout);
                }
                if (socketTimeout) {
                  parsedUrl.searchParams.set('socket_timeout', socketTimeout);
                }
                dbUrl = parsedUrl.toString();
              } catch (err) {
                // Fallback to original url
              }
            }
            return dbUrl;
          })(),
        },
      },
    });

    const extended = this.$extends({
      query: {
        $allOperations: async ({ model, operation, args, query }) => {
          const isWrite = [
            'create',
            'createMany',
            'update',
            'updateMany',
            'upsert',
            'delete',
            'deleteMany',
            'executeRaw',
          ].includes(operation);

          const result = await query(args);

          if (isWrite) {
            try {
              this.handleWriteInvalidation(model || 'Unknown', args, result);
            } catch (e) {
              console.error('Error handling write cache invalidation:', e);
            }
          }

          return result;
        },
      },
    });

    this.extendedClient = extended;

    return new Proxy(this, {
      get(target, prop, receiver) {
        if (prop === '$transaction') {
          return async (args: any, options?: any) => {
            const store: {
              invalidationQueue: Array<() => Promise<void> | void>;
            } = {
              invalidationQueue: [],
            };
            return transactionContext.run(store, async () => {
              const result = await extended.$transaction(args, options);
              // Execute queued invalidations only after the transaction is successfully committed
              for (const fn of store.invalidationQueue) {
                try {
                  await fn();
                } catch (error) {
                  console.error(
                    'Failed to execute deferred cache invalidation:',
                    error,
                  );
                }
              }
              return result;
            });
          };
        }

        const localOverrides = [
          'onModuleInit',
          'onModuleDestroy',
          'enableShutdownHooks',
          'handleWriteInvalidation',
          'getAffectedUserIds',
          'invalidateUserCache',
          'invalidateGlobalCache',
          'cacheService',
          'extendedClient',
        ];

        if (localOverrides.includes(prop as string)) {
          const value = Reflect.get(target, prop, receiver);
          if (typeof value === 'function') {
            return value.bind(target);
          }
          return value;
        }

        if (prop in extended) {
          const value = Reflect.get(extended, prop, receiver);
          if (typeof value === 'function') {
            return value.bind(extended);
          }
          return value;
        }

        const value = Reflect.get(target, prop, receiver);
        if (typeof value === 'function') {
          return value.bind(target);
        }
        return value;
      },
    }) as any;
  }

  async onModuleInit() {
    await this.extendedClient.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }

  private handleWriteInvalidation(model: string, args: any, result: any) {
    const isProfileRelated = [
      'User',
      'UserProfile',
      'UserPhoto',
      'PartnerPreference',
      'PersonalInformation',
      'BlockedUser',
      'ReportedUser',
    ].includes(model);
    const isSuccessStoryRelated = [
      'SuccessStory',
      'SuccessStoryPhoto',
    ].includes(model);
    const isNotificationRelated = ['Notification'].includes(model);
    const isInterestRelated = ['ProfileInterest'].includes(model);
    const isReportRelated = ['ReportProblem'].includes(model);

    if (
      !isProfileRelated &&
      !isSuccessStoryRelated &&
      !isNotificationRelated &&
      !isInterestRelated &&
      !isReportRelated
    ) {
      return;
    }

    const invalidationFn = async () => {
      try {
        const userIds = this.getAffectedUserIds(model, args, result);

        if (isProfileRelated) {
          await Promise.all([
            ...userIds.map((userId) => this.invalidateUserProfileCache(userId)),
            this.invalidateGlobalProfileCache(),
          ]);
        }

        if (isSuccessStoryRelated) {
          const storyId =
            result?.id || args?.id || (args?.where && args.where.id);
          await Promise.all([
            ...userIds.map((userId) => this.invalidateUserProfileCache(userId)),
            ...userIds.map((userId) =>
              this.invalidateUserSuccessStoryCache(userId),
            ),
            this.invalidateGlobalSuccessStoryCache(storyId),
            this.invalidateGlobalProfileCache(),
          ]);
        }

        if (isNotificationRelated) {
          await Promise.all(
            userIds.map((userId) =>
              this.invalidateUserNotificationCache(userId),
            ),
          );
        }

        if (isInterestRelated) {
          const interestId =
            result?.id || args?.id || (args?.where && args.where.id);
          await Promise.all([
            ...userIds.map((userId) =>
              this.invalidateUserInterestCache(userId, interestId),
            ),
            ...userIds.map((userId) =>
              this.invalidateUserProfileListCache(userId),
            ),
          ]);
        }

        if (isReportRelated) {
          const reportId =
            result?.id || args?.id || (args?.where && args.where.id);
          await Promise.all(
            userIds.map((userId) =>
              this.invalidateUserReportCache(userId, reportId),
            ),
          );
        }
      } catch (error) {
        console.error('Failed to invalidate cache:', error);
      }
    };

    const store = transactionContext.getStore();
    if (store) {
      store.invalidationQueue.push(invalidationFn);
    } else {
      // Execute immediately (asynchronously) if not in a transaction
      invalidationFn().catch((err) => console.error(err));
    }
  }

  private getAffectedUserIds(model: string, args: any, result: any): number[] {
    const ids = new Set<number>();

    const addId = (val: any) => {
      if (typeof val === 'number') {
        ids.add(val);
      } else if (typeof val === 'string' && !isNaN(Number(val))) {
        ids.add(Number(val));
      }
    };

    // 1. Extract from query result
    if (result) {
      if (model === 'User' && result.id) {
        addId(result.id);
      }
      if (result.userId) {
        addId(result.userId);
      }
      if (result.senderId) {
        addId(result.senderId);
      }
      if (result.receiverId) {
        addId(result.receiverId);
      }
      if (result.partnerId) {
        addId(result.partnerId);
      }
      if (result.blockerId) {
        addId(result.blockerId);
      }
      if (result.blockedId) {
        addId(result.blockedId);
      }
      if (result.reporterId) {
        addId(result.reporterId);
      }
      if (result.reportedId) {
        addId(result.reportedId);
      }
    }

    // 2. Extract from query arguments
    if (args) {
      const traverse = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
          if (key === 'userId' || (model === 'User' && key === 'id')) {
            const val = obj[key];
            if (typeof val === 'number') {
              addId(val);
            } else if (val && typeof val === 'object') {
              if (Array.isArray(val.in)) {
                val.in.forEach(addId);
              } else if (typeof val.equals === 'number') {
                addId(val.equals);
              }
            }
          } else if (
            key === 'senderId' ||
            key === 'receiverId' ||
            key === 'partnerId' ||
            key === 'blockerId' ||
            key === 'blockedId' ||
            key === 'reporterId' ||
            key === 'reportedId'
          ) {
            addId(obj[key]);
          } else {
            traverse(obj[key]);
          }
        }
      };
      traverse(args);
    }

    // 3. Fallback to request context (current logged in user)
    const store = requestContext.getStore();
    if (store?.userId) {
      addId(store.userId);
    }

    return Array.from(ids);
  }

  // ----------------------------------------------------
  // Granular Invalidation Helpers
  // ----------------------------------------------------

  private async invalidateUserProfileCache(userId: number) {
    await Promise.all([
      this.cacheService.delete(`user:${userId}`),
      this.cacheService.delete(`profile:${userId}`),
      this.cacheService.delete(`biodata:${userId}`),
      this.cacheService.delete(`dashboard:${userId}`),
      this.cacheService.delete(`v1:profile:me:${userId}`),
      this.cacheService.delete(`v1:profile:photos:${userId}`),
      this.cacheService.deleteByPattern(`v1:profile:user:*:${userId}`),
      this.cacheService.deleteByPattern(`v1:profile:user:${userId}:*`),
      this.invalidateUserProfileListCache(userId),
    ]);
  }

  private async invalidateUserProfileListCache(userId: number) {
    await Promise.all([
      this.cacheService.deleteByPattern(`v1:profile:all:${userId}:*`),
      this.cacheService.deleteByPattern(`v1:profile:partner:${userId}:*`),
      this.cacheService.deleteByPattern(`v1:search:${userId}:*`),
    ]);
  }

  private async invalidateUserSuccessStoryCache(userId: number) {
    await Promise.all([
      this.cacheService.delete(`v1:success-story:user:${userId}`),
    ]);
  }

  private async invalidateUserNotificationCache(userId: number) {
    await Promise.all([
      this.cacheService.delete(`notification:${userId}`),
      this.cacheService.deleteByPattern(`v1:notification:list:${userId}:*`),
      this.cacheService.deleteByPattern(`v1:notification:unread:${userId}:*`),
      this.cacheService.delete(`v1:notification:count:${userId}`),
      this.cacheService.deleteByPattern(`v1:notification:${userId}:*`),
    ]);
  }

  private async invalidateUserInterestCache(
    userId: number,
    interestId?: number,
  ) {
    const promises = [
      this.cacheService.deleteByPattern(`v1:interest:received:${userId}:*`),
      this.cacheService.deleteByPattern(`v1:interest:sent:${userId}:*`),
    ];
    if (interestId) {
      promises.push(this.cacheService.delete(`v1:interest:${interestId}`));
    }
    await Promise.all(promises);
  }

  private async invalidateUserReportCache(userId: number, reportId?: number) {
    const promises = [
      this.cacheService.deleteByPattern(`v1:report-problem:my:${userId}:*`),
    ];
    if (reportId) {
      promises.push(
        this.cacheService.delete(`v1:report-problem:${userId}:${reportId}`),
      );
    }
    await Promise.all(promises);
  }

  private async invalidateGlobalProfileCache() {
    await Promise.all([
      this.cacheService.deleteByPattern('profile:list*'),
      this.cacheService.deleteByPattern('v1:profile:public:*'),
      this.cacheService.deleteByPattern('v1:profile:all:*'),
      this.cacheService.deleteByPattern('v1:profile:partner:*'),
      this.cacheService.deleteByPattern('profile:search*'),
      this.cacheService.deleteByPattern('search*'),
      this.cacheService.deleteByPattern('match*'),
      this.cacheService.deleteByPattern('recommendation*'),
      this.cacheService.deleteByPattern('v1:search:*'),
      this.cacheService.deleteByPattern('statistics*'),
      this.cacheService.deleteByPattern('analytics*'),
    ]);
  }

  private async invalidateGlobalSuccessStoryCache(storyId?: number) {
    const promises = [
      this.cacheService.deleteByPattern('success-story:list*'),
      this.cacheService.deleteByPattern('v1:success-story:list:*'),
    ];
    if (storyId) {
      promises.push(this.cacheService.delete(`v1:success-story:${storyId}`));
    }
    await Promise.all(promises);
  }

  // Retained legacy methods for backwards compatibility / local overrides
  private async invalidateUserCache(userId: number) {
    await this.invalidateUserProfileCache(userId);
    await this.invalidateUserNotificationCache(userId);
    await this.invalidateUserSuccessStoryCache(userId);
    await this.invalidateUserInterestCache(userId);
  }

  private async invalidateGlobalCache(model: string, result: any) {
    await this.invalidateGlobalProfileCache();
    await this.invalidateGlobalSuccessStoryCache(result?.id);
  }
}
