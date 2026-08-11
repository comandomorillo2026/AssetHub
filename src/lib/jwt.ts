import * as jose from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'zeitgeist-jwt-secret-2026-caribbean-saas-asset-hub-prod';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'zeitgeist-refresh-secret-2026-caribbean-saas';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

function parseDuration(dur: string): number {
  const match = dur.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // default 15m
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

const secretKey = new TextEncoder().encode(JWT_SECRET);
const refreshKey = new TextEncoder().encode(JWT_REFRESH_SECRET);

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
  return jose.signJWT(payload, secretKey, { expiresIn: parseDuration(JWT_EXPIRES_IN) });
}

export function signRefreshToken(userId: string, tenantId: string): string {
  return jose.signJWT(
    { userId, tenantId, type: 'refresh' },
    refreshKey,
    { expiresIn: parseDuration(JWT_REFRESH_EXPIRES_IN) }
  );
}

export function signSuperAdminToken(payload: SuperAdminJwtPayload): string {
  return jose.signJWT(payload, secretKey, { expiresIn: 3600 }); // 1h
}

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const { payload } = await jose.jwtVerify(token, secretKey);
  return payload as unknown as JwtPayload;
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string; tenantId: string; type: string }> {
  const { payload } = await jose.jwtVerify(token, refreshKey);
  return payload as unknown as { userId: string; tenantId: string; type: string };
}

export async function verifySuperAdminToken(token: string): Promise<SuperAdminJwtPayload> {
  const { payload } = await jose.jwtVerify(token, secretKey);
  return payload as unknown as SuperAdminJwtPayload;
}

export function hashPassword(password: string): string {
  const bcrypt = require('bcryptjs');
  return bcrypt.hashSync(password, 12);
}

export function comparePassword(password: string, hash: string): boolean {
  const bcrypt = require('bcryptjs');
  return bcrypt.compareSync(password, hash);
}