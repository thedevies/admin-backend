import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
      algorithms: ['HS256'],
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    const rawToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);

    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.userId,
      },
    });

    if (!user || user.isDeleted || !user.isActive) {
      throw new UnauthorizedException('User not found or account inactive');
    }

    if (rawToken) {
      const activeSession = await this.prisma.session.findFirst({
        where: {
          userId: user.id,
          token: rawToken,
          isActive: true,
        },
      });

      if (!activeSession) {
        throw new UnauthorizedException(
          'Session expired or account accessed from another device',
        );
      }
    }

    return user;
  }
}
