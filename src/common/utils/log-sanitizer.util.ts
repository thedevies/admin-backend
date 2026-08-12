function maskEmail(email: string): string {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return email;
  }
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `*@${domain}`;
  }
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

function maskMobile(mobile: string): string {
  if (!mobile) return mobile;
  const cleanMobile = String(mobile).trim();
  if (cleanMobile.length <= 4) {
    return '*'.repeat(cleanMobile.length);
  }
  return '*'.repeat(cleanMobile.length - 4) + cleanMobile.slice(-4);
}

export function sanitizeLogData(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    if (typeof obj === 'string') {
      if (
        obj.startsWith('Bearer ') ||
        (obj.split('.').length === 3 && obj.length > 50)
      ) {
        return '[REDACTED JWT]';
      }
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeLogData);
  }

  const sanitized: any = {};
  const sensitiveKeys = [
    'password',
    'otp',
    'jwt',
    'refreshtoken',
    'authorization',
    'token',
    'accesstoken',
    'secret',
    'apikey',
    'passwordconfirm',
    'newpassword',
    'oldpassword',
    'privatekey',
    'private_key',
    'credential',
  ];
  const emailKeys = ['email', 'emailaddress'];
  const mobileKeys = ['mobile', 'mobilenumber', 'phone', 'phonenumber'];

  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase();
    const val = obj[key];

    const isSensitive = sensitiveKeys.some((sk) => lowerKey.includes(sk));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (emailKeys.includes(lowerKey) && typeof val === 'string') {
      sanitized[key] = maskEmail(val);
    } else if (
      mobileKeys.includes(lowerKey) &&
      (typeof val === 'string' || typeof val === 'number')
    ) {
      sanitized[key] = maskMobile(String(val));
    } else if (typeof val === 'object') {
      sanitized[key] = sanitizeLogData(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}
