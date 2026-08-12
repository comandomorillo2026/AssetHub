import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requirePermission, logAudit } from '@/lib/auth-helpers';
import { userUpdateSchema, validateBody } from '@/lib/validations';

const ROLE_HIERARCHY: Record<string, number> = {
  admin: 3,
  auditor: 2,
  user: 1,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = getAuthContext(request);
    if (auth instanceof NextResponse) return auth;

    const { tenantId } = auth;

    const user = await db.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        phone: true,
        department: true,
        jobTitle: true,
        isActive: true,
        lastLogin: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            auditLogs: true,
            checkouts: true,
            reservations: true,
            requestedWorkOrders: true,
            assignedWorkOrders: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const assetCount = await db.asset.count({
      where: { tenantId, assignedTo: user.name },
    });

    const maintenanceCount = await db.maintenance.count({
      where: {
        tenantId,
        performedBy: user.name,
      },
    });

    return NextResponse.json({
      data: {
        ...user,
        assetCount,
        maintenanceCount,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = getAuthContext(request);
    if (auth instanceof NextResponse) return auth;

    const permCheck = requirePermission(auth, 'canManageUsers');
    if (permCheck) return permCheck;

    const { tenantId, userId, role: authRole } = auth;

    const existing = await db.user.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();

    const validation = validateBody(userUpdateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Cannot change own role to a lower level
    if (id === userId && validation.data.role) {
      const currentLevel = ROLE_HIERARCHY[existing.role] || 0;
      const newLevel = ROLE_HIERARCHY[validation.data.role] || 0;
      if (newLevel < currentLevel) {
        return NextResponse.json(
          { error: 'Cannot change your own role to a lower level' },
          { status: 403 },
        );
      }
    }

    // Non-admin cannot promote to admin
    if (validation.data.role === 'admin' && authRole !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can assign the admin role' },
        { status: 403 },
      );
    }

    const { name, role, phone, department, jobTitle, isActive, avatar } = validation.data;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (phone !== undefined) updateData.phone = phone;
    if (department !== undefined) updateData.department = department;
    if (jobTitle !== undefined) updateData.jobTitle = jobTitle;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (avatar !== undefined) updateData.avatar = avatar;

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        phone: true,
        department: true,
        jobTitle: true,
        isActive: true,
        lastLogin: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const changes: string[] = [];
    if (name && name !== existing.name) changes.push(`name: "${existing.name}" → "${name}"`);
    if (role && role !== existing.role) changes.push(`role: ${existing.role} → ${role}`);
    if (isActive !== undefined && isActive !== existing.isActive) {
      changes.push(`isActive: ${existing.isActive} → ${isActive}`);
    }
    if (department !== undefined && department !== existing.department) changes.push('department updated');
    if (jobTitle !== undefined && jobTitle !== existing.jobTitle) changes.push('jobTitle updated');
    if (phone !== undefined && phone !== existing.phone) changes.push('phone updated');
    if (avatar !== undefined && avatar !== existing.avatar) changes.push('avatar updated');

    if (changes.length > 0) {
      await logAudit({
        db,
        tenantId,
        userId,
        action: 'user_updated',
        details: `Updated user "${existing.name}" (${existing.email}): ${changes.join('; ')}`,
      });
    }

    return NextResponse.json({ data: user });
  } catch (error: unknown) {
    console.error('Update user error:', error);
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'A user with this email already exists in this tenant' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = getAuthContext(request);
    if (auth instanceof NextResponse) return auth;

    const permCheck = requirePermission(auth, 'canManageUsers');
    if (permCheck) return permCheck;

    const { tenantId, userId } = auth;

    if (id === userId) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own account' },
        { status: 403 },
      );
    }

    const existing = await db.user.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!existing.isActive) {
      return NextResponse.json(
        { error: 'User is already deactivated' },
        { status: 400 },
      );
    }

    await db.user.update({
      where: { id },
      data: { isActive: false },
    });

    await logAudit({
      db,
      tenantId,
      userId,
      action: 'user_deactivated',
      details: `Deactivated user "${existing.name}" (${existing.email})`,
    });

    return NextResponse.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
