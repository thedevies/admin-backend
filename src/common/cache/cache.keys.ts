export const CacheKeys = {
  /**
   * Public Profiles
   */
  publicProfiles: (page: number, limit: number, gender?: string): string => {
    return `profile:public:page:${page}:limit:${limit}:gender:${gender ?? 'all'}`;
  },

  /**
   * Profile Details
   */
  profileDetails: (profileId: number): string => {
    return `profile:${profileId}`;
  },

  /**
   * User Recommendations
   */
  recommendations: (userId: number): string => {
    return `recommendation:user:${userId}`;
  },

  /**
   * Success Stories
   */
  successStories: (page: number, limit: number): string => {
    return `success-story:page:${page}:limit:${limit}`;
  },

  /**
   * Master Data
   */
  masterData: (type: string): string => {
    return `master:${type}`;
  },
};
