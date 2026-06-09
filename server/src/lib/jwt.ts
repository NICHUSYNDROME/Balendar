import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'balendar-dev-secret-key';
const EXPIRES_IN = '7d';

export interface JwtPayload {
  sub: string;
  role: 'admin' | 'manager' | 'musician';
  username: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}
