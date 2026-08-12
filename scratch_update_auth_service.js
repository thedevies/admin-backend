const fs = require('fs');
const file = 'd:/Dhruvexa Technologies/VVS/admin-backend/src/modules/auth/auth.service.ts';
let content = fs.readFileSync(file, 'utf8');

const newMethods = `
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
`;

content = content.replace(/async getLoginHistory/, newMethods + '\n  async getLoginHistory');
fs.writeFileSync(file, content);
console.log('Added admin login step 1 and 2 to auth.service.ts');
