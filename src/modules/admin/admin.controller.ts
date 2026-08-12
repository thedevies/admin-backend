import { Controller, Get, Param, UseGuards, Patch, Body, Post, Delete } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AuthGuard('jwt'))
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Patch('user/:userId/deactivate')
  async deactivateUser(@Param('userId') userId: string) {
    const data = await this.adminService.toggleUserActivation(Number(userId));
    return {
      success: true,
      message: 'User activation status toggled successfully',
      data
    };
  }


  
  @Get('accounts')
  async getAdminAccounts() {
    const data = await this.adminService.getAdminAccounts();
    return { success: true, message: 'Admin accounts fetched successfully', data };
  }

  @Post('accounts')
  async addAdminAccount(@Body() data: any) {
    try {
      const result = await this.adminService.addAdminAccount(data);
      return { success: true, message: 'Admin account created successfully', data: result };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  @Delete('accounts/:email')
  async deleteAdminAccount(@Param('email') email: string) {
    try {
      const result = await this.adminService.deleteAdminAccount(email);
      return { success: true, message: 'Admin account deleted successfully', data: result };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }


  @Get('profiles')
  async getAllProfiles() {
    const data = await this.adminService.getAllProfiles();
    return {
      success: true,
      message: 'All candidate profiles fetched successfully',
      data
    };
  }

  @Get('stats')
  async getStats() {
    const data = await this.adminService.getStats();
    return {
      success: true,
      message: 'Admin stats fetched successfully',
      data
    };
  }

  @Get('user/:userId')
  async getUserProfile(@Param('userId') userId: string) {
    const data = await this.adminService.getUserProfile(Number(userId));
    return {
      success: true,
      message: 'User profile fetched successfully',
      data
    };
  }

  @Get('problems')
  async getAllProblems() {
    const data = await this.adminService.getAllProblems();
    return {
      success: true,
      message: 'Reported problems fetched successfully',
      data
    };
  }

  @Patch('problems')
  async updateProblemStatus(
    @Body('id') id: number,
    @Body('status') status: string,
    @Body('adminRemark') adminRemark?: string
  ) {
    const data = await this.adminService.updateProblemStatus(id, status, adminRemark);
    return {
      success: true,
      message: 'Problem status updated successfully',
      data
    };
  }

  @Post('notification/broadcast')
  async broadcastNotification(
    @Body('title') title: string,
    @Body('body') body: string
  ) {
    const data = await this.adminService.broadcastNotification(title, body);
    return {
      success: true,
      message: 'Notification broadcasted successfully',
      data
    };
  }
}
