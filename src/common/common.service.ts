import { Injectable } from '@nestjs/common';
import { Gender, MaritalStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';
import {
  getPreferredGender,
  getDobFilter,
} from 'src/common/utils/profile-match.util';
import { CacheService } from './cache/cache.service';
import { getSearchProfilesKey, SEARCH_RESULTS } from './redis';
import * as crypto from 'crypto';

@Injectable()
export class CommonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: CacheService,
  ) {}

  async searchProfiles(user: any, dto: SearchQueryDto) {
    try {
      const page = Math.max(Number(dto.page) || 1, 1);
      const limit = Math.min(Math.max(Number(dto.limit) || 10, 1), 100);
      const skip = (page - 1) * limit;

      const filterObj = {
        search: dto.search?.trim() || null,
        gender: dto.gender || null,
        maritalStatus: dto.maritalStatus || null,
        country: dto.country || null,
        state: dto.state || null,
        city: dto.city || null,
        education: dto.education || null,
        profession: dto.profession || null,
        sortBy: dto.sortBy || null,
        sortOrder: dto.sortOrder || null,
      };

      const filterHash = crypto
        .createHash('md5')
        .update(JSON.stringify(filterObj))
        .digest('hex');

      const cacheKey = getSearchProfilesKey(user.id, filterHash, page, limit);

      return this.redisService.getOrSet(
        cacheKey,
        async () => {
          const loggedInUser = await this.prisma.user.findUnique({
            where: {
              id: user.id,
            },
            include: {
              profile: true,
            },
          });

          if (!loggedInUser || !loggedInUser.profile) {
            return {
              message: 'User profile not found',
            };
          }

          const preferredGender = getPreferredGender(
            loggedInUser.profile.lookingFor,
          );

          const dobFilter = getDobFilter(
            loggedInUser.profile.lookingFor,
            loggedInUser.profile.dateOfBirth,
          );

          const blocks = await this.prisma.blockedUser.findMany({
            where: {
              OR: [{ blockerId: user.id }, { blockedId: user.id }],
            },
            select: {
              blockerId: true,
              blockedId: true,
            },
          });
          const blockedUserIds = Array.from(
            new Set(
              blocks
                .flatMap((b) => [b.blockerId, b.blockedId])
                .filter((id) => id !== user.id),
            ),
          );

          const where: Prisma.UserProfileWhereInput = {
            userId: {
              not: user.id,
              notIn: blockedUserIds,
            },
            user: {
              is: {
                isDeleted: false,
                isActive: true,
              },
            },
            successStory: false,

            ...(preferredGender && {
              gender: preferredGender,
            }),

            ...dobFilter,
          };

          // ------------------------
          // Global Search
          // ------------------------
          if (dto.search?.trim()) {
            where.OR = [
              {
                fullName: {
                  contains: dto.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                city: {
                  contains: dto.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                profession: {
                  contains: dto.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                education: {
                  contains: dto.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                bio: {
                  contains: dto.search.trim(),
                  mode: 'insensitive',
                },
              },
            ];
          }

          // ------------------------
          // Filters
          // ------------------------

          if (dto.gender) {
            where.gender = dto.gender;
          }

          if (dto.maritalStatus) {
            where.maritalStatus = dto.maritalStatus;
          }

          if (dto.country) {
            where.country = {
              contains: dto.country,
              mode: 'insensitive',
            };
          }

          if (dto.state) {
            where.state = {
              contains: dto.state,
              mode: 'insensitive',
            };
          }

          if (dto.city) {
            where.city = {
              contains: dto.city,
              mode: 'insensitive',
            };
          }

          if (dto.education) {
            where.education = {
              contains: dto.education,
              mode: 'insensitive',
            };
          }

          if (dto.profession) {
            where.profession = {
              contains: dto.profession,
              mode: 'insensitive',
            };
          }

          // ------------------------
          // Sorting
          // ------------------------

          const allowedSortFields = [
            'createdAt',
            'updatedAt',
            'fullName',
            'city',
            'profession',
            'education',
          ];

          const sortBy = allowedSortFields.includes(dto.sortBy || '')
            ? dto.sortBy!
            : 'createdAt';

          const sortOrder: Prisma.SortOrder =
            dto.sortOrder === 'asc' ? 'asc' : 'desc';

          // ------------------------
          // Query
          // ------------------------

          const [profiles, total] = await Promise.all([
            this.prisma.userProfile.findMany({
              where,
              include: {
                user: {
                  select: {
                    id: true,
                    mobile: true,
                    email: true,
                    biodata: true,
                    isMobileVerified: true,
                    isEmailVerified: true,
                  },
                },
              },
              skip,
              take: limit,
              orderBy: {
                [sortBy]: sortOrder,
              },
            }),

            this.prisma.userProfile.count({
              where,
            }),
          ]);

          const profileUserIds = profiles.map((p) => p.userId);
          const interests =
            profileUserIds.length > 0
              ? await this.prisma.profileInterest.findMany({
                  where: {
                    OR: [
                      { senderId: user.id, receiverId: { in: profileUserIds } },
                      { senderId: { in: profileUserIds }, receiverId: user.id },
                    ],
                    status: {
                      in: ['PENDING', 'ACCEPTED'],
                    },
                  },
                })
              : [];

          const mappedProfiles = profiles.map((profile) => {
            const interest = interests.find(
              (i) =>
                (i.senderId === user.id && i.receiverId === profile.userId) ||
                (i.senderId === profile.userId && i.receiverId === user.id),
            );

            return {
              ...profile,
              interestStatus: interest ? interest.status : null,
              isInterestSender: interest
                ? interest.senderId === user.id
                : false,
              interestId: interest ? interest.id : null,
            };
          });

          return {
            message: 'Profiles fetched successfully',
            data: mappedProfiles,
            pagination: {
              total,
              page,
              limit,
              totalPages: Math.ceil(total / limit),
              hasNextPage: page < Math.ceil(total / limit),
              hasPreviousPage: page > 1,
            },
          };
        },
        {
          ttl: SEARCH_RESULTS,
          staleWhileRevalidate: true,
          backgroundRefresh: true,
        },
      );
    } catch (error) {
      return {
        message: 'Failed to search profiles',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
