/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing';
import { CommonService } from './common.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheService } from './cache/cache.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { Gender, MaritalStatus } from '@prisma/client';
import * as crypto from 'crypto';

describe('CommonService Caching', () => {
  let service: CommonService;
  let prisma: any;
  let redisService: any;

  const mockUser = { id: 1 };
  const mockLoggedInUser = {
    id: 1,
    profile: {
      id: 10,
      userId: 1,
      lookingFor: 'BRIDE',
      dateOfBirth: new Date('1995-01-01'),
      gender: Gender.MALE,
    },
  };

  const mockProfile = {
    id: 20,
    userId: 2,
    fullName: 'Jane Doe',
    gender: Gender.FEMALE,
    dateOfBirth: new Date('1996-01-01'),
    maritalStatus: MaritalStatus.NEVER_MARRIED,
    country: 'India',
    state: 'Maharashtra',
    city: 'Mumbai',
    education: 'Bachelor',
    profession: 'Software Engineer',
    bio: 'Test Bio',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDto: SearchQueryDto = {
    search: 'Jane',
    gender: Gender.FEMALE,
    maritalStatus: MaritalStatus.NEVER_MARRIED,
    country: 'India',
    state: 'Maharashtra',
    city: 'Mumbai',
    education: 'Bachelor',
    profession: 'Software Engineer',
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };

  const filterObj = {
    search: mockDto.search?.trim() || null,
    gender: mockDto.gender || null,
    maritalStatus: mockDto.maritalStatus || null,
    country: mockDto.country || null,
    state: mockDto.state || null,
    city: mockDto.city || null,
    education: mockDto.education || null,
    profession: mockDto.profession || null,
    sortBy: mockDto.sortBy || null,
    sortOrder: mockDto.sortOrder || null,
  };

  const filterHash = crypto
    .createHash('md5')
    .update(JSON.stringify(filterObj))
    .digest('hex');

  const expectedCacheKey = `v1:search:1:${filterHash}:1:10`;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      userProfile: {
        findMany: jest.fn().mockResolvedValue([mockProfile]),
        count: jest.fn().mockResolvedValue(1),
      },
      profileInterest: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      blockedUser: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest
        .fn()
        .mockImplementation((promises) => Promise.all(promises)),
    };

    redisService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      deleteByPattern: jest.fn(),
      getOrSet: jest.fn().mockImplementation(async (key, dbQuery, options) => {
        try {
          const cached = await redisService.get(key);
          if (cached) {
            return cached;
          }
        } catch (error) {
          return await dbQuery();
        }
        const result = await dbQuery();
        let doCache = true;
        if (options?.shouldCache) {
          doCache = options.shouldCache(result);
        }
        if (doCache) {
          try {
            await redisService.set(key, result, options?.ttl);
          } catch (error) {
            // Safe fail
          }
        }
        return result;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommonService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: redisService },
      ],
    }).compile();

    service = module.get<CommonService>(CommonService);
  });

  describe('searchProfiles', () => {
    it('should return cached profiles on cache hit', async () => {
      const cachedResponse = {
        message: 'Profiles fetched successfully',
        data: [mockProfile],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      redisService.get.mockResolvedValue(cachedResponse);

      const result: any = await service.searchProfiles(mockUser, mockDto);

      expect(redisService.get).toHaveBeenCalledWith(expectedCacheKey);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual(cachedResponse);
    });

    it('should fetch from db and set cache on cache miss', async () => {
      redisService.get.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockLoggedInUser);
      prisma.profileInterest.findMany.mockResolvedValue([]);

      // Mock database queries executed in $transaction
      prisma.userProfile.findMany = jest.fn().mockResolvedValue([mockProfile]);
      prisma.userProfile.count = jest.fn().mockResolvedValue(1);
      prisma.$transaction.mockResolvedValue([[mockProfile], 1]);

      const result: any = await service.searchProfiles(mockUser, mockDto);

      expect(redisService.get).toHaveBeenCalledWith(expectedCacheKey);
      expect(prisma.user.findUnique).toHaveBeenCalled();
      expect(prisma.userProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            successStory: false,
          }),
        }),
      );
      expect(redisService.set).toHaveBeenCalledWith(
        expectedCacheKey,
        expect.objectContaining({
          message: 'Profiles fetched successfully',
          data: expect.any(Array),
          pagination: expect.objectContaining({ total: 1 }),
        }),
        300, // SEARCH_RESULTS TTL
      );
      expect(result.data[0].fullName).toEqual(mockProfile.fullName);
    });

    it('should fallback to db and ignore cache when Redis fails', async () => {
      redisService.get.mockRejectedValue(new Error('Redis is down'));
      prisma.user.findUnique.mockResolvedValue(mockLoggedInUser);
      prisma.profileInterest.findMany.mockResolvedValue([]);
      prisma.$transaction.mockResolvedValue([[mockProfile], 1]);

      const result: any = await service.searchProfiles(mockUser, mockDto);

      expect(redisService.get).toHaveBeenCalledWith(expectedCacheKey);
      expect(prisma.user.findUnique).toHaveBeenCalled();
      expect(result.message).toEqual('Profiles fetched successfully');
      expect(result.data[0].fullName).toEqual(mockProfile.fullName);
    });
  });
});
