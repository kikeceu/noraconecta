import jwt from 'jsonwebtoken';

export interface JwtPayload {
  adminId: string;
  email: string;
  role: 'SUPERADMIN' | 'OPERATOR';
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

const JWT_EXPIRATION = '24h';

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: JWT_EXPIRATION });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET as string) as JwtPayload;
}
