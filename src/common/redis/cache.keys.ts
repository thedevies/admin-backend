import * as crypto from 'crypto';

export const getPublicProfilesKey = (
  page: number | string,
  limit: number | string,
  gender?: string,
): string => {
  const genderStr = gender ? gender.toLowerCase() : 'all';
  return `v1:profile:public:${page}:${limit}:${genderStr}`;
};

export const getAllProfilesKey = (
  userId: number | string,
  page: number | string,
  limit: number | string,
): string => {
  return `v1:profile:all:${userId}:${page}:${limit}`;
};

export const getPartnerProfilesKey = (
  userId: number | string,
  filterHash: string,
  page: number | string,
  limit: number | string,
): string => {
  return `v1:profile:partner:${userId}:${filterHash}:${page}:${limit}`;
};

export const getMyProfileKey = (userId: number | string): string => {
  return `v1:profile:me:${userId}`;
};

export const getUserProfileKey = (
  viewerId: number | string,
  targetUserId: number | string,
): string => {
  return `v1:profile:user:${viewerId}:${targetUserId}`;
};

export const getPhotosKey = (userId: number | string): string => {
  return `v1:profile:photos:${userId}`;
};

export const getSuccessStoryListKey = (
  page: number | string,
  limit: number | string,
  filters?: Record<string, any>,
): string => {
  if (filters && Object.keys(filters).length > 0) {
    const filterHash = crypto
      .createHash('md5')
      .update(JSON.stringify(filters))
      .digest('hex');
    return `v1:success-story:list:${filterHash}:${page}:${limit}`;
  }
  return `v1:success-story:list:${page}:${limit}`;
};

export const getSuccessStoryByIdKey = (storyId: number | string): string => {
  return `v1:success-story:${storyId}`;
};

export const getSuccessStoryUserKey = (userId: number | string): string => {
  return `v1:success-story:user:${userId}`;
};

export const getNotificationListKey = (
  userId: number | string,
  page: number | string,
  limit: number | string,
  filters?: Record<string, any>,
): string => {
  if (filters && Object.keys(filters).length > 0) {
    const filterHash = crypto
      .createHash('md5')
      .update(JSON.stringify(filters))
      .digest('hex');
    return `v1:notification:list:${userId}:${filterHash}:${page}:${limit}`;
  }
  return `v1:notification:list:${userId}:${page}:${limit}`;
};

export const getNotificationUnreadKey = (
  userId: number | string,
  page: number | string,
  limit: number | string,
): string => {
  return `v1:notification:unread:${userId}:${page}:${limit}`;
};

export const getNotificationCountKey = (userId: number | string): string => {
  return `v1:notification:count:${userId}`;
};

export const getNotificationDetailsKey = (
  userId: number | string,
  notificationId: number | string,
): string => {
  return `v1:notification:${userId}:${notificationId}`;
};

export const getNotificationSenderKey = (
  userId: number | string,
  notificationId: number | string,
): string => {
  return `v1:notification:${userId}:${notificationId}:sender`;
};

export const getSearchProfilesKey = (
  userId: number | string,
  filterHash: string,
  page: number | string,
  limit: number | string,
): string => {
  return `v1:search:${userId}:${filterHash}:${page}:${limit}`;
};

export const getReceivedInterestsKey = (
  userId: number | string,
  page: number | string,
  limit: number | string,
  filters?: Record<string, any>,
): string => {
  if (filters && Object.keys(filters).length > 0) {
    const filterHash = crypto
      .createHash('md5')
      .update(JSON.stringify(filters))
      .digest('hex');
    return `v1:interest:received:${userId}:${filterHash}:${page}:${limit}`;
  }
  return `v1:interest:received:${userId}:${page}:${limit}`;
};

export const getSentInterestsKey = (
  userId: number | string,
  page: number | string,
  limit: number | string,
  filters?: Record<string, any>,
): string => {
  if (filters && Object.keys(filters).length > 0) {
    const filterHash = crypto
      .createHash('md5')
      .update(JSON.stringify(filters))
      .digest('hex');
    return `v1:interest:sent:${userId}:${filterHash}:${page}:${limit}`;
  }
  return `v1:interest:sent:${userId}:${page}:${limit}`;
};

export const getInterestByIdKey = (interestId: number | string): string => {
  return `v1:interest:${interestId}`;
};

export const getMyReportsKey = (
  userId: number | string,
  page: number | string,
  limit: number | string,
  filters?: Record<string, any>,
): string => {
  if (filters && Object.keys(filters).length > 0) {
    const filterHash = crypto
      .createHash('md5')
      .update(JSON.stringify(filters))
      .digest('hex');
    return `v1:report-problem:my:${userId}:${filterHash}:${page}:${limit}`;
  }
  return `v1:report-problem:my:${userId}:${page}:${limit}`;
};

export const getReportByIdKey = (
  userId: number | string,
  reportId: number | string,
): string => {
  return `v1:report-problem:${userId}:${reportId}`;
};
