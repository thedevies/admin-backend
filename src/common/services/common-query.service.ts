import { Injectable } from '@nestjs/common';
import { SearchQueryDto } from '../dto/search-query.dto';

@Injectable()
export class CommonQueryService {
  buildQuery(dto: SearchQueryDto) {
    const page = Math.max(dto.page || 1, 1);
    const limit = Math.min(dto.limit || 10, 100);

    return {
      page,
      limit,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        [dto.sortBy || 'createdAt']: dto.sortOrder || 'desc',
      },
    };
  }
}
