import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export type UserRole = 'admin' | 'auditor' | 'user';

const ROLE_PERMISSIONS: Record<UserRole, { canCreate: boolean; canUpdate: boolean; canDelete: boolean; canManageUsers: boolean; canManageBilling: boolean; canExport: boolean; canImport: boolean }> = {
  admin: { canCreate: true, canUpdate: true, canDelete: true, canManageUsers: true, canManageBilling: true, canExport: true, canImport: true },
  auditor: { canCreate: false, canUpdate: false, canDelete: false, canManageUsers: false, canManageBilling: false, canExport: true, canImport: false },
  user: { canCreate: true, canUpdate: true, canDelete: false, canManageUsers: false, canManageBilling: false, canExport: true, canImport: false },
};

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  permissions: typeof ROLE_PERMISSIONS[UserRole];
}

export function getAuthContext(request: NextRequest): AuthContext | NextResponse {
  const userId = request.headers.get('x-auth-user-id');
  const tenantId = request.headers.get('x-auth-tenant-id');
  const role = request.headers.get('x-auth-role') as UserRole;

  if (!userId || !tenantId || !role) {
    return NextResponse.json({ error: 'Authentication context missing' }, { status: 401 });
  }

  const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.user;
  return { userId, tenantId, role, permissions };
}

export function requirePermission(auth: AuthContext, permission: keyof typeof ROLE_PERMISSIONS.admin): NextResponse | null {
  if (!auth.permissions[permission]) {
    return NextResponse.json({ error: 'Insufficient permissions for this action' }, { status: 403 });
  }
  return null;
}

export async function logAudit(params: {
  db: PrismaClient;
  tenantId: string;
  userId: string;
  action: string;
  details: string;
  assetId?: string;
}) {
  try {
    await params.db.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        action: params.action,
        details: params.details,
        assetId: params.assetId,
      },
    });
  } catch (error) {
    // Audit logging should never break the main operation
    console.error('Audit log failed:', error);
  }
}
