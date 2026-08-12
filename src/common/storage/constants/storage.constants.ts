export const ALLOWED_FOLDERS = {
  PROFILE: 'users/profile',
  GALLERY: 'users/gallery',
  BIODATA: 'documents/biodata',
} as const;

export type StorageFolder =
  (typeof ALLOWED_FOLDERS)[keyof typeof ALLOWED_FOLDERS];
