import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { randomInt } from 'crypto';

export class TooManyRequestsException extends HttpException {
  constructor(message?: string) {
    super(message || 'Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly cacheService: CacheService,
  ) {}

  // Need country code validation and support for multiple countries in the future. Currently, it's hardcoded to support only Indian mobile numbers.
  async sendOtp(sendOtpDto: SendOtpDto) {
    try {
      const mobile = sendOtpDto.mobile;
      if (!mobile) {
        throw new BadRequestException('Mobile number is required.');
      }

      const cooldownKey = `otp_cooldown:${mobile}`;
      const hasCooldown = await this.cacheService.get<string>(cooldownKey);
      if (hasCooldown) {
        throw new TooManyRequestsException(
          'Please wait before requesting a new OTP.',
        );
      }

      const otp = randomInt(100000, 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await this.prisma.otp.create({
        data: {
          mobile,
          otp,
          expiresAt,
        },
      });

      await this.cacheService.set(cooldownKey, 'true', 60);

      return {
        message: 'OTP sent successfully',
        data: {
          mobile,
          otp,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async verifyOtp(dto: VerifyOtpDto, request: any) {
    try {
      const mobile = dto.mobile;
      if (!mobile) {
        throw new BadRequestException('Mobile number is required.');
      }

      const attemptsKey = `otp_attempts:${mobile}`;
      const attempts = (await this.cacheService.get<number>(attemptsKey)) || 0;

      if (attempts >= 5) {
        throw new TooManyRequestsException(
          'Too many verification attempts. Please request a new OTP.',
        );
      }

      // 1. Verify OTP
      const otpRecord = await this.prisma.otp.findFirst({
        where: {
          mobile,
          otp: dto.otp,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!otpRecord) {
        const newAttempts = attempts + 1;
        await this.cacheService.set(attemptsKey, newAttempts, 300);
        throw new BadRequestException('Invalid OTP');
      }

      if (otpRecord.expiresAt < new Date()) {
        throw new BadRequestException('OTP expired');
      }

      // Clear attempts cache (OTP was correct).
      // NOTE: Do NOT delete the OTP record yet when there are other active sessions
      // and confirmNewDevice has not been set — we need the OTP to remain valid
      // so the second call (with confirmNewDevice:true) can re-verify it.
      await this.cacheService.delete(attemptsKey);

      // 2. Find or create user
      let user = await this.prisma.user.findFirst({
        where: { mobile, isDeleted: false },
      });

      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            isMobileVerified: true,
            isActive: true,
          },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            mobile,
            isMobileVerified: true,
          },
        });
      }

      // 3. Get deviceId
      const deviceId = dto.deviceId || 'unknown';

      // 4. Check if SAME device already has active session
      const existingSession = await this.prisma.session.findFirst({
        where: {
          userId: user.id,
          deviceId: deviceId,
          isActive: true,
        },
      });

      const accessSecret =
        process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
      const refreshSecret =
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
      if (!accessSecret || !refreshSecret) {
        throw new Error('JWT Secret is not configured');
      }

      // 5. SAME DEVICE LOGIN → reuse existing session if token still valid
      if (existingSession) {
        let accessToken = existingSession.token;

        try {
          this.jwtService.verify(accessToken, { secret: accessSecret });
        } catch (err) {
          accessToken = this.jwtService.sign(
            { userId: user.id, mobile: user.mobile },
            { secret: accessSecret, expiresIn: '15m' },
          );
          await this.prisma.session.update({
            where: { id: existingSession.id },
            data: { token: accessToken },
          });
        }

        // Safe to delete OTP now that session is confirmed
        await this.prisma.otp.deleteMany({ where: { mobile } });

        return {
          message: 'Login successful',
          accessToken,
          token: accessToken,
          refreshToken: existingSession.refreshToken,
          sessionId: existingSession.id,
          user,
        };
      }

      // 6. DIFFERENT DEVICE LOGIN
      const otherActiveSessions = await this.prisma.session.findMany({
        where: {
          userId: user.id,
          deviceId: { not: deviceId },
          isActive: true,
        },
      });

      if (otherActiveSessions.length > 0 && dto.confirmNewDevice !== true) {
        // Return the human-readable name of the first old active session's device.
        // The frontend uses this to show "Your account will be logged out from <deviceName>".
        const oldSession = otherActiveSessions[0] as any;
        const oldDeviceName: string =
          oldSession.deviceName ||
          oldSession.deviceId ||
          'another device';
        return {
          anotherDeviceActive: true,
          deviceName: oldDeviceName,
          message:
            'Another active device session exists. Please confirm to log out other devices.',
        };
      }

      // confirmNewDevice === true → user confirmed. Now it is safe to delete the OTP.
      await this.prisma.otp.deleteMany({
        where: { mobile },
      });

      if (otherActiveSessions.length > 0) {
        await this.prisma.session.updateMany({
          where: {
            userId: user.id,
            deviceId: { not: deviceId },
            isActive: true,
          },
          data: {
            isActive: false,
          },
        });

        // Store the new device name in cache so old devices can show a
        // meaningful auto-logout message ("Logged in on <device>").
        // TTL = 10 minutes, plenty of time for the old device to pick it up.
        const newDeviceName = dto.deviceName || deviceId || 'another device';
        await this.cacheService.set(
          `new_device_login:${user.id}`,
          newDeviceName,
          600,
        );
      }

      // 7. Create Access Token
      const accessToken = this.jwtService.sign(
        {
          userId: user.id,
          mobile: user.mobile,
        },
        {
          secret: accessSecret,
          expiresIn: '15m',
        },
      );

      // 8. Create Refresh Token
      const refreshToken = this.jwtService.sign(
        {
          userId: user.id,
        },
        {
          secret: refreshSecret,
          expiresIn: '30d',
        },
      );

      // 9. Create new session
      const session = await this.prisma.session.create({
        data: {
          userId: user.id,
          token: accessToken,
          refreshToken: refreshToken,
          deviceId,
          deviceName: dto.deviceName || null,
          isActive: true,
          ipAddress:
            (request?.headers?.['x-forwarded-for'] as string) ||
            request?.socket?.remoteAddress ||
            'unknown',
        },
      });

      // 10. Return response
      return {
        message: 'Login successful',
        accessToken,
        token: accessToken,
        refreshToken,
        sessionId: session.id,
        user,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async adminLogin(mobile: string, fcmToken?: string, deviceId?: string) {
    const accessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'secret';
    
    // 1. Find or create user for the admin
    let user = await this.prisma.user.findFirst({
      where: { mobile, isDeleted: false },
    });
    if (!user) {
      user = await this.prisma.user.create({
        data: { mobile, isMobileVerified: true },
      });
    }
    
    // 2. Generate Token
    const accessToken = this.jwtService.sign(
      { userId: user.id, mobile: user.mobile, role: 'admin' },
      { secret: accessSecret, expiresIn: '7d' }
    );
    
    // 3. Create Session (required for JWT Strategy validation)
    const actualDeviceId = deviceId || 'admin-web-dashboard';
    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: accessToken,
        deviceId: actualDeviceId,
        deviceName: 'Admin Dashboard',
        isActive: true,
      },
    });

    // 4. Update Notification FCM Token if provided
    if (fcmToken) {
      await this.prisma.userDevice.upsert({
        where: { userId_deviceId: { userId: user.id, deviceId: actualDeviceId } },
        update: { fcmToken, platform: 'ANDROID', isActive: true },
        create: {
          userId: user.id,
          deviceId: actualDeviceId,
          fcmToken,
          platform: 'ANDROID',
          isActive: true
        }
      });
    }
    
    return {
      success: true,
      message: 'Admin token generated successfully',
      token: accessToken
    };
  }

  
  async adminLoginStep1(email: string, passwordInput: string) {
    const admin = await this.prisma.adminAccount.findUnique({ where: { email } });
    if (!admin) {
      throw new UnauthorizedException('Authentication failed. Admin account not found.');
    }
    if (admin.password !== passwordInput) {
      throw new UnauthorizedException('Authentication failed. Invalid password.');
    }
    if (admin.status !== 'Active') {
      throw new UnauthorizedException('Your admin account is inactive.');
    }

    const mobile = admin.mobile;
    const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // clear old otps for this mobile
    await this.prisma.otp.deleteMany({ where: { mobile } });
    
    await this.prisma.otp.create({
      data: {
        mobile,
        otp,
        expiresAt,
      },
    });

    const maskedMobile = '******' + mobile.slice(-4);
    return {
      success: true,
      message: 'OTP sent successfully',
      maskedMobile,
      // Sending otp in response for testing/development. In prod, use SMS gateway.
      developmentOtp: otp
    };
  }

  async adminLoginStep2(email: string, otpInput: string) {
    const admin = await this.prisma.adminAccount.findUnique({ where: { email } });
    if (!admin) {
      throw new UnauthorizedException('Authentication failed.');
    }

    const otpRecord = await this.prisma.otp.findFirst({
      where: { mobile: admin.mobile, otp: otpInput },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    await this.prisma.otp.deleteMany({ where: { mobile: admin.mobile } });

    const accessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'secret';
    const accessToken = this.jwtService.sign(
      { userId: admin.id, email: admin.email, role: admin.role, adminLogin: true },
      { secret: accessSecret, expiresIn: '7d' }
    );

    return {
      success: true,
      message: 'Admin login successful',
      accessToken,
      admin: {
        name: admin.name,
        email: admin.email,
        role: admin.role,
        avatar: admin.avatar
      }
    };
  }

  async getLoginHistory(userId: number) {
    try {
      const sessions = await this.prisma.session.findMany({
        where: {
          userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return {
        message: 'Login history fetched successfully',
        data: sessions,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async logout(sessionId: number) {
    try {
      const session = await this.prisma.session.findUnique({
        where: {
          id: sessionId,
        },
      });

      if (!session) {
        throw new NotFoundException('Session not found');
      }

      await this.prisma.session.update({
        where: {
          id: sessionId,
        },
        data: {
          isActive: false,
        },
      });

      return {
        message: 'Logged out successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      const session = await this.prisma.session.findFirst({
        where: {
          refreshToken,
          isActive: true,
        },
      });

      if (!session) {
        const reusedSession = await this.prisma.session.findFirst({
          where: { refreshToken },
        });
        if (reusedSession) {
          // Check if this session was deactivated because a new device logged in.
          // If so, surface the new device name so the frontend can show a proper message.
          const newDeviceName = await this.cacheService.get<string>(
            `new_device_login:${reusedSession.userId}`,
          );
          if (newDeviceName) {
            throw new HttpException(
              {
                message: 'Your account has been logged in on a new device.',
                code: 'SESSION_REPLACED',
                newDeviceName,
              },
              HttpStatus.UNAUTHORIZED,
            );
          }
        }
        throw new UnauthorizedException('Invalid refresh token');
      }

      const accessSecret =
        process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
      const refreshSecret =
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
      if (!accessSecret || !refreshSecret) {
        throw new Error('JWT Secret is not configured');
      }

      const decoded = this.jwtService.verify(refreshToken, {
        secret: refreshSecret,
      });

      const newAccessToken = this.jwtService.sign(
        {
          userId: decoded.userId,
        },
        {
          secret: accessSecret,
          expiresIn: '15m',
        },
      );

      await this.prisma.session.update({
        where: {
          id: session.id,
        },
        data: {
          token: newAccessToken,
        },
      });

      return {
        accessToken: newAccessToken,
      };
    } catch (error) {
      try {
        const session = await this.prisma.session.findFirst({
          where: { refreshToken },
        });
        if (session) {
          await this.prisma.session.update({
            where: { id: session.id },
            data: { isActive: false },
          });
        }
      } catch (e) {
        // ignore
      }

      if (error instanceof HttpException) {
        throw error;
      }
      throw new UnauthorizedException(
        error instanceof Error ? error.message : 'Invalid refresh token',
      );
    }
  }

  async logoutPreviousDevices(userId: number, currentToken: string) {
    try {
      const currentSession = await this.prisma.session.findFirst({
        where: {
          userId,
          token: currentToken,
          isActive: true,
        },
      });

      const result = await this.prisma.session.updateMany({
        where: {
          userId,
          id: currentSession ? { not: currentSession.id } : undefined,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      return {
        message: 'Logged out other devices successfully',
        deactivatedCount: result.count,
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
