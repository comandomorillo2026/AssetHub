import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'zeitgeist-jwt-secret-2026-caribbean-saas-asset-hub-prod';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'zeitgeist-refresh-secret-2026-caribbean-saas';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

export interface SuperAdminJwtPayload {
  adminId: string;
  email: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function signRefreshToken(userId: string, tenantId: string): string {
  return jwt.sign(
    { userId, tenantId, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions
  );
}

export function signSuperAdminToken(payload: SuperAdminJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): { userId: string; tenantId: string; type: string } {
  return jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string; tenantId: string; type: string };
}

export function verifySuperAdminToken(token: string): SuperAdminJwtPayload {
  return jwt.verify(token, JWT_SECRET) as SuperAdminJwtPayload;
}

export function hashPassword(password: string): string {
  const bcrypt = require('bcryptjs');
  return bcrypt.hashSync(password, 12);
}

export function comparePassword(password: string, hash: string): boolean {
  const bcrypt = require('bcryptjs');
  return bcrypt.compareSync(password, hash);
}