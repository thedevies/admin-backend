import {
  Body,
  Controller,
  Post,
  Req,
  Param,
  UseGuards,
  Get,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Req() request: any) {
    return {
      message: 'Protected route accessed',
      user: request.user,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getMe(@Req() request: any) {
    return {
      message: 'User fetched successfully',
      user: request.user,
    };
  }

  @Post('send-otp')
  sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto);
  }

  @Post('verify-otp')
  verifyOtp(@Body() verifyOtpDto: VerifyOtpDto, @Req() request: Request) {
    return this.authService.verifyOtp(verifyOtpDto, request);
  }

  @Post('admin-login')
  adminLogin(
    @Body('mobile') mobile: string,
    @Body('fcmToken') fcmToken?: string,
    @Body('deviceId') deviceId?: string
  ) {
    return this.authService.adminLogin(mobile, fcmToken, deviceId);
  }

  @Post('admin-login-step1')
  adminLoginStep1(@Body() body: { email: string; password: string }) {
    return this.authService.adminLoginStep1(body.email, body.password);
  }

  @Post('admin-login-step2')
  adminLoginStep2(@Body() body: { email: string; otp: string }) {
    return this.authService.adminLoginStep2(body.email, body.otp);
  }

  @Post('login-history/:userId')
  getLoginHistory(@Param('userId') userId: string) {
    return this.authService.getLoginHistory(Number(userId));
  }

  @Post('logout')
  logout(@Body() body: { sessionId: number }) {
    return this.authService.logout(body.sessionId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout-previous-device')
  logoutPreviousDevice(@Req() request: any) {
    const authHeader = request.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    return this.authService.logoutPreviousDevices(request.user.id, token);
  }

  @Post('refresh-token')
  refreshToken(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken);
  }
}
