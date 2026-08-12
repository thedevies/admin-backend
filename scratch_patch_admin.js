const fs = require('fs');

// Patch admin.service.ts
const adminServiceFile = 'd:/Dhruvexa Technologies/VVS/admin-backend/src/modules/admin/admin.service.ts';
let adminServiceContent = fs.readFileSync(adminServiceFile, 'utf8');

const serviceMethods = `
  async getAdminAccounts() {
    return await this.prisma.adminAccount.findMany({
      select: { name: true, email: true, mobile: true, role: true, avatar: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async addAdminAccount(data: any) {
    const existing = await this.prisma.adminAccount.findFirst({
      where: {
        OR: [ { email: data.email }, { mobile: data.mobile } ]
      }
    });
    if (existing) {
      throw new Error('An administrator with this email or mobile already exists.');
    }
    return await this.prisma.adminAccount.create({
      data: {
        name: data.name,
        email: data.email,
        mobile: data.mobile,
        role: data.role,
        password: data.password,
        status: data.status || 'Active',
      }
    });
  }

  async deleteAdminAccount(email: string) {
    // Prevent deleting primary super admins
    if (email === 'satish.hande@vvsdhruvexa.in' || email === 'shivraj.taware@vvsdhruvexa.in') {
      throw new Error('Cannot delete primary system administrator accounts.');
    }
    return await this.prisma.adminAccount.delete({
      where: { email }
    });
  }
`;

adminServiceContent = adminServiceContent.replace(/async getAllProfiles\(\) \{/, serviceMethods + '\n\n  async getAllProfiles() {');
fs.writeFileSync(adminServiceFile, adminServiceContent);

// Patch admin.controller.ts
const adminControllerFile = 'd:/Dhruvexa Technologies/VVS/admin-backend/src/modules/admin/admin.controller.ts';
let adminControllerContent = fs.readFileSync(adminControllerFile, 'utf8');

const controllerMethods = `
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
`;

// Needs Delete from @nestjs/common
adminControllerContent = adminControllerContent.replace(/import \{ Controller, Get, Param, UseGuards, Patch, Body, Post \} from '@nestjs\/common';/, "import { Controller, Get, Param, UseGuards, Patch, Body, Post, Delete } from '@nestjs/common';");
adminControllerContent = adminControllerContent.replace(/@Get\('profiles'\)/, controllerMethods + '\n\n  @Get(\'profiles\')');
fs.writeFileSync(adminControllerFile, adminControllerContent);

console.log('Successfully patched admin service and controller for admin accounts API.');
