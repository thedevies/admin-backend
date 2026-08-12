import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { CacheService } from '../../common/cache/cache.service';

describe('AuthService Security', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let cacheService: any;

  beforeEach(async () => {
    const mockPrisma = {
      otp: {
        create: jest.fn(),
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      session: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
      verify: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    cacheService = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendOtp', () => {
    it('should return error response if mobile number is not provided', async () => {
      await expect(
        service.sendOtp({ mobile: '', deviceId: 'dev1' }),
      ).rejects.toThrow('Mobile number is required.');
    });

    it('should return error response if OTP is requested within cooldown period', async () => {
      cacheService.get.mockResolvedValue('true'); // active cooldown

      await expect(
        service.sendOtp({ mobile: '9999999999', deviceId: 'dev1' }),
      ).rejects.toThrow('Please wait before requesting a new OTP.');
      expect(cacheService.get).toHaveBeenCalledWith('otp_cooldown:9999999999');
    });

    it('should generate OTP and set cooldown if no cooldown exists', async () => {
      cacheService.get.mockResolvedValue(null);
      prisma.otp.create.mockResolvedValue({ id: 1 });

      const res: any = await service.sendOtp({
        mobile: '9999999999',
        deviceId: 'dev1',
      });
      expect(res.message).toBe('OTP sent successfully');
      expect(res.data.otp).toBeDefined();
      expect(prisma.otp.create).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalledWith(
        'otp_cooldown:9999999999',
        'true',
        60,
      );
    });
  });

  describe('verifyOtp', () => {
    it('should return error response if too many attempts are recorded', async () => {
      cacheService.get.mockResolvedValue(5); // 5 attempts

      await expect(
        service.verifyOtp(
          {
            mobile: '9999999999',
            otp: '123456',
            deviceId: 'dev1',
            ipAddress: '127.0.0.1',
          },
          {},
        ),
      ).rejects.toThrow(
        'Too many verification attempts. Please request a new OTP.',
      );
    });

    it('should increment attempt count and return Invalid OTP on invalid OTP', async () => {
      cacheService.get.mockResolvedValue(2);
      prisma.otp.findFirst.mockResolvedValue(null); // not found

      await expect(
        service.verifyOtp(
          {
            mobile: '9999999999',
            otp: '123456',
            deviceId: 'dev1',
            ipAddress: '127.0.0.1',
          },
          {},
        ),
      ).rejects.toThrow('Invalid OTP');

      expect(cacheService.set).toHaveBeenCalledWith(
        'otp_attempts:9999999999',
        3,
        300,
      );
    });

    it('should return OTP expired on expired OTP', async () => {
      cacheService.get.mockResolvedValue(0);
      prisma.otp.findFirst.mockResolvedValue({
        otp: '123456',
        expiresAt: new Date(Date.now() - 1000), // expired
      });

      await expect(
        service.verifyOtp(
          {
            mobile: '9999999999',
            otp: '123456',
            deviceId: 'dev1',
            ipAddress: '127.0.0.1',
          },
          {},
        ),
      ).rejects.toThrow('OTP expired');
    });
  });

  describe('refreshToken', () => {
    it('should revoke all user sessions and return Invalid refresh token if refresh token is reused after revoking/expiring', async () => {
      // 1. Session is not active (inactive, could be revoked or already used)
      prisma.session.findFirst
        .mockResolvedValueOnce(null) // first findFirst fails (no active session matches)
        .mockResolvedValueOnce({ id: 10, userId: 42 }); // second findFirst finds it for reuse check

      await expect(service.refreshToken('reused-token')).rejects.toThrow(
        'Invalid refresh token',
      );

      // Verify it invalidated all sessions for that user
      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 42 },
        data: { isActive: false },
      });
    });

    it('should rotate access token and update session for active valid refresh token', async () => {
      process.env.JWT_SECRET = 'test-secret';
      prisma.session.findFirst.mockResolvedValue({
        id: 10,
        userId: 42,
        refreshToken: 'valid-token',
        isActive: true,
      });
      jwtService.verify.mockReturnValue({ userId: 42 });
      jwtService.sign.mockReturnValue('new-access-token');

      const res = await service.refreshToken('valid-token');
      expect(res.accessToken).toBe('new-access-token');
      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { token: 'new-access-token' },
      });
    });
  });
});
