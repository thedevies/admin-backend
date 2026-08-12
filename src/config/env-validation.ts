import * as process from 'process';

export function validateEnv() {
  const accessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  const refreshSecret =
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!accessSecret) {
    throw new Error(
      'CRITICAL CONFIGURATION ERROR: JWT_ACCESS_SECRET or JWT_SECRET must be defined in the environment.',
    );
  }
  if (!refreshSecret) {
    throw new Error(
      'CRITICAL CONFIGURATION ERROR: JWT_REFRESH_SECRET or JWT_SECRET must be defined in the environment.',
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'CRITICAL CONFIGURATION ERROR: DATABASE_URL must be defined in the environment.',
    );
  }

  // Validate Firebase configurations
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
  const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!firebaseProjectId) {
    throw new Error(
      'CRITICAL CONFIGURATION ERROR: FIREBASE_PROJECT_ID must be defined in the environment.',
    );
  }
  if (!firebaseClientEmail) {
    throw new Error(
      'CRITICAL CONFIGURATION ERROR: FIREBASE_CLIENT_EMAIL must be defined in the environment.',
    );
  }
  if (!firebasePrivateKey) {
    throw new Error(
      'CRITICAL CONFIGURATION ERROR: FIREBASE_PRIVATE_KEY must be defined in the environment.',
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(firebaseClientEmail)) {
    throw new Error(
      `CRITICAL CONFIGURATION ERROR: FIREBASE_CLIENT_EMAIL is malformed. Provided value "${firebaseClientEmail}" is not a valid email address.`,
    );
  }

  const cleanKey = firebasePrivateKey.replace(/\\n/g, '\n');
  if (
    !cleanKey.includes('-----BEGIN PRIVATE KEY-----') ||
    !cleanKey.includes('-----END PRIVATE KEY-----')
  ) {
    throw new Error(
      'CRITICAL CONFIGURATION ERROR: FIREBASE_PRIVATE_KEY is malformed. It must be a valid PEM-formatted private key containing "-----BEGIN PRIVATE KEY-----" and "-----END PRIVATE KEY-----".',
    );
  }

  // Validate PORT
  if (!process.env.PORT) {
    throw new Error(
      'CRITICAL CONFIGURATION ERROR: PORT must be defined in the environment.',
    );
  }

  // Validate Redis configurations
  if (!process.env.REDIS_URL) {
    if (!process.env.REDIS_HOST) {
      throw new Error(
        'CRITICAL CONFIGURATION ERROR: REDIS_HOST must be defined in the environment when REDIS_URL is not provided.',
      );
    }
    if (!process.env.REDIS_PORT) {
      throw new Error(
        'CRITICAL CONFIGURATION ERROR: REDIS_PORT must be defined in the environment when REDIS_URL is not provided.',
      );
    }
  }

  // Validate ImageKit configurations
  if (!process.env.IMAGEKIT_PUBLIC_KEY) {
    throw new Error(
      'CRITICAL CONFIGURATION ERROR: IMAGEKIT_PUBLIC_KEY must be defined in the environment.',
    );
  }
  if (!process.env.IMAGEKIT_PRIVATE_KEY) {
    throw new Error(
      'CRITICAL CONFIGURATION ERROR: IMAGEKIT_PRIVATE_KEY must be defined in the environment.',
    );
  }
  if (!process.env.IMAGEKIT_URL_ENDPOINT) {
    throw new Error(
      'CRITICAL CONFIGURATION ERROR: IMAGEKIT_URL_ENDPOINT must be defined in the environment.',
    );
  }

  // Validate CORS
  if (!process.env.CORS_ORIGIN) {
    console.warn(
      'WARNING: CORS_ORIGIN is not defined in the environment. Falling back to allow all origins ("*").',
    );
  }

  // If there are other secrets, check them too
  const criticalKeys = ['IMAGEKIT_PRIVATE_KEY'];
  for (const key of criticalKeys) {
    if (
      process.env[key] &&
      (process.env[key]?.includes('your-') ||
        process.env[key]?.includes('placeholder'))
    ) {
      console.warn(`WARNING: ${key} contains a placeholder value.`);
    }
  }
}
