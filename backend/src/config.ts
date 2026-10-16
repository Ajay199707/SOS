import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgres://sos:sos_dev@localhost:5432/sos_guardian',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me-please-32+',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me-please-32+',
  jwtAccessTtl: process.env.JWT_ACCESS_TTL || '15m',
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL || '30d',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  fcmStub: (process.env.FCM_STUB ?? 'true') === 'true',
  smsProvider: process.env.SMS_PROVIDER || 'stub',
  turnUrls: (process.env.TURN_URLS || '').split(',').filter(Boolean),
  turnUsername: process.env.TURN_USERNAME || '',
  turnCredential: process.env.TURN_CREDENTIAL || '',
  turnSharedSecret: process.env.TURN_SHARED_SECRET || '',
  locationRetentionDays: parseInt(process.env.LOCATION_RETENTION_DAYS || '30', 10),
};
