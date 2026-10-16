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
