import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('FATAL: JWT_SECRET environment variable is not set.');
  return new TextEncoder().encode(secret);
}

function getRefreshSecret(): Uint8Array {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('FATAL: JWT_REFRESH_SECRET environment variable is not set.');
  return new TextEncoder().encode(secret);
}

function parseDuration(dur: string): number {
  const match = dur.match(/^(\d+)([smhd])$/);
  if (!match) return 900;
  const val = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's': return val;
    case 'm': return val * 60;
    case 'h': return val * 3600;
    case 'd': return val * 86400;
    default: return 900;
  }
}

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

export async function signAccessToken(payload: JwtPayload): Promise<string> {
  const expiresIn = process.env.JWT_EXPIRES_IN || '15m';
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(parseDuration(expiresIn) + 's')
    .sign(getJwtSecret());
}

export async function signRefreshToken(userId: string, tenantId: string): Promise<string> {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  return new SignJWT({ userId, tenantId, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(parseDuration(expiresIn) + 's')
    .sign(getRefreshSecret());
}

export async function signSuperAdminToken(payload: SuperAdminJwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(getJwtSecret());
}

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return payload as unknown as JwtPayload;
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string; tenantId: string; type: string }> {
  const { payload } = await jwtVerify(token, getRefreshSecret());
  return payload as unknown as { userId: string; tenantId: string; type: string };
}

export async function verifySuperAdminToken(token: string): Promise<SuperAdminJwtPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return payload as unknown as SuperAdminJwtPayload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
