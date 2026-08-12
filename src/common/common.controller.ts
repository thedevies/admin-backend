import { Req, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { CommonService } from './common.service';
import { SearchQueryDto } from './dto/search-query.dto';

@Controller('common/profiles')
export class CommonController {
  constructor(private readonly commonService: CommonService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('search')
  searchProfiles(@Req() request: any, @Body() dto: SearchQueryDto) {
    return this.commonService.searchProfiles(request.user, dto);
  }
}
