import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function signAccess(payload: object): string {
  return jwt.sign(payload, config.jwtAccessSecret, { expiresIn: config.jwtAccessTtl } as any);
}
export function signRefresh(payload: object): string {
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshTtl } as any);
}
export function verifyAccess(token: string): any {
  return jwt.verify(token, config.jwtAccessSecret);
}
export function verifyRefresh(token: string): any {
  return jwt.verify(token, config.jwtRefreshSecret);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(id: unknown): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id);
}
