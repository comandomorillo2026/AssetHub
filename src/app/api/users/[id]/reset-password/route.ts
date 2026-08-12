import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requirePermission, logAudit } from '@/lib/auth-helpers';
import { passwordResetSchema, validateBody } from '@/lib/validations';
import { hashPassword } from '@/lib/jwt';

export async function POST(
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

    const existing = await db.user.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();

    const validation = validateBody(passwordResetSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const passwordHash = await hashPassword(validation.data.password);

    await db.user.update({
      where: { id },
      data: { passwordHash },
    });

    await logAudit({
      db,
      tenantId,
      userId,
      action: 'user_password_reset',
      details: `Admin reset password for user "${existing.name}" (${existing.email})`,
    });

    return NextResponse.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
