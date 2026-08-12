import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as admin from 'firebase-admin';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {
    if (admin.apps.length === 0) {
      try {
        if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
          });
          this.logger.log('Firebase initialized successfully for broadcast.');
        } else {
          this.logger.warn('Firebase credentials missing. Push notifications disabled.');
        }
      } catch (error) {
        this.logger.error('Failed to initialize Firebase Admin SDK', error);
      }
    }
  }

  
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


  async getAllProfiles() {
    const users = await this.prisma.user.findMany({
      include: {
        profile: true,
        photos: true,
        biodata: true,
        personalInformation: true,
        successStory: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    return users.map(user => {
      const p = (user.profile || {}) as any;
      return {
        id: user.id,
        fullName: p.fullName || 'Not Provided',
        gender: p.gender || 'MALE',
        city: p.city || 'Not Provided',
        mobile: user.mobile || 'Not Provided',
        email: user.email || p.email || 'Not Provided',
        createdAt: user.createdAt,
        isDeleted: user.isDeleted,
        isActive: user.isActive,
        updatedAt: user.updatedAt,
        profilePhoto: p.profilePhoto || null,
        age: p.dateOfBirth ? new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear() : undefined,
        profession: p.profession || 'Not Provided',
        education: p.education || 'Not Provided',
        isMarried: !!user.successStory || p.successStory === true,
        profile: p
      };
    });
  }

  async getStats() {
    const [
      totalUsers,
      successStories,
      pendingApprovals,
      reportsCount,
      blockedCount,
      maleCount,
      femaleCount,
      deactivatedCount,
      deletedCount,
    ] = await Promise.all([
      this.prisma.user.count({ where: { isDeleted: false } }),
      this.prisma.successStory.count(),
      this.prisma.user.count({ where: { isDeleted: false, isMobileVerified: false } }),
      this.prisma.reportProblem.count(),
      this.prisma.blockedUser.count(),
      this.prisma.userProfile.count({ where: { gender: 'MALE' } }),
      this.prisma.userProfile.count({ where: { gender: 'FEMALE' } }),
      this.prisma.user.count({ where: { isActive: false, isDeleted: false } }),
      this.prisma.user.count({ where: { isDeleted: true } }),
    ]);

    return {
      totalUsers,
      premiumUsers: successStories,
      pendingApprovals,
      reportsCount,
      blockedCount,
      maleCount,
      femaleCount,
      paymentsCount: 0,
      supportCount: reportsCount,
      deactivatedCount,
      deletedCount,
    };
  }

  async getUserProfile(userId: number) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isDeleted: false },
      include: {
        profile: true,
        photos: true,
        biodata: true,
        personalInformation: true,
        partnerPreference: true,
      }
    });

    if (!user) return null;

    const successStory = await this.prisma.successStory.findFirst({
      where: {
        OR: [
          { userId: userId },
          { partnerId: String(userId) }
        ]
      },
      include: {
        user: {
          select: {
            profile: {
              select: {
                id: true,
                userId: true,
                profilePhoto: true,
                profession: true,
                education: true,
                fullName: true,
              }
            }
          }
        }
      }
    });

    let successStoryWithPartner: any = null;
    if (successStory) {
      const partnerProfile = successStory.partnerId
        ? await this.prisma.userProfile.findUnique({
            where: { userId: Number(successStory.partnerId) },
            select: {
              id: true,
              userId: true,
              profilePhoto: true,
              profession: true,
              education: true,
              fullName: true,
            }
          })
        : null;

      successStoryWithPartner = {
        ...successStory,
        partnerProfile
      };
    }

    return {
      ...user,
      personalInformation: user.personalInformation,
      interestStatus: null,
      isInterestSender: false,
      interestId: null,
      successStory: successStoryWithPartner
    };
  }

  async getAllProblems() {
    return this.prisma.reportProblem.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { profile: { select: { fullName: true, profilePhoto: true } } } },
      }
    });
  }

  
  async toggleUserActivation(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    
    const newStatus = !user.isActive;
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: newStatus }
    });

    const title = newStatus ? 'Account Activated' : 'Account Deactivated';
    const body = newStatus 
      ? 'Your account is activated by Admin. Welcome back!' 
      : 'Your account is deactivated by Admin, contact support team for more help';

    // 1. Save to database for system notifications
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          title,
          body,
          type: 'ADMIN',
          isRead: false
        }
      });
    } catch (dbErr) {
      this.logger.error('Failed to create activation notification in DB', dbErr);
    }

    // 2. Send push notification via FCM
    try {
      if (admin.apps.length > 0) {
        const devices = await this.prisma.userDevice.findMany({
          where: { userId, isActive: true },
          select: { fcmToken: true }
        });
        const tokens = [...new Set(devices.map(d => d.fcmToken as string))].filter(t => t && t.trim().length > 0);
        
        if (tokens.length > 0) {
          const messages = tokens.map(token => ({
            token,
            notification: { title, body },
            android: { priority: 'high' as const },
          }));
          await admin.messaging().sendEach(messages).catch(() => null);
        }
      }
    } catch (fcmErr) {
      this.logger.error('Failed to send push notification', fcmErr);
    }

    return updatedUser;
  }

  async updateProblemStatus(id: number, status: any, adminRemark?: string) {
    return this.prisma.reportProblem.update({
      where: { id },
      data: { status, adminRemark },
    });
  }

  async broadcastNotification(title: string, body: string) {
    let successCount = 0;
    let failureCount = 0;
    let totalTargets = 0;

    // 1. Send Push Notifications via FCM
    if (admin.apps.length > 0) {
      const devices = await this.prisma.userDevice.findMany({
        where: { isActive: true },
        select: { fcmToken: true },
      });

      const tokens = [...new Set(devices.map(d => d.fcmToken as string))].filter(t => t && t.trim().length > 0);
      totalTargets = tokens.length;
      
      if (tokens.length > 0) {
        const messages = tokens.map(token => ({
          token,
          notification: { title, body },
          android: { priority: 'high' as const },
        }));

        const chunks: any[] = [];
        for (let i = 0; i < messages.length; i += 500) {
          chunks.push(messages.slice(i, i + 500));
        }

        for (const chunk of chunks) {
          try {
            const response = await admin.messaging().sendEach(chunk);
            successCount += response.successCount;
            failureCount += response.failureCount;
          } catch (err) {
            this.logger.error('Error sending broadcast chunk', err);
          }
        }
      }
    }

    // 2. Save Notification to Database for App In-App Notifications
    try {
      const allUsers = await this.prisma.user.findMany({
        where: { isDeleted: false },
        select: { id: true }
      });

      if (allUsers.length > 0) {
        const notificationsToInsert = allUsers.map(user => ({
          userId: user.id,
          title,
          body,
          type: 'ADMIN' as const,
          isRead: false
        }));

        // Insert in chunks of 5000 to prevent packet too large errors
        for (let i = 0; i < notificationsToInsert.length; i += 5000) {
          await this.prisma.notification.createMany({
            data: notificationsToInsert.slice(i, i + 5000),
            skipDuplicates: true
          });
        }
      }
    } catch (dbErr) {
      this.logger.error('Error saving broadcast notifications to database', dbErr);
    }

    return {
      success: true,
      sentTo: successCount,
      failed: failureCount,
      totalTargets
    };
  }
}
