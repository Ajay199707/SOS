import type { Request, Response, NextFunction } from 'express';
import { verifyAccess } from '../utils/tokens.js';

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer (.+)$/);
  if (!m) return res.status(401).json({ error: 'missing bearer token' });
  try {
    const decoded: any = verifyAccess(m[1]);
    req.userId = decoded.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
}
