import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id');
    const userId = request.headers.get('x-auth-user-id');
    const role = request.headers.get('x-auth-role');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-auth-tenant-id header is required' },
        { status: 400 }
      );
    }

    // Only admins can rollback migrations
    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can rollback migrations' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Find the migration and verify it belongs to this tenant
    const migration = await db.dataMigration.findUnique({
      where: { id },
    });

    if (!migration) {
      return NextResponse.json(
        { error: 'Migration not found' },
        { status: 404 }
      );
    }

    if (migration.tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Migration not found' },
        { status: 404 }
      );
    }

    // Only completed migrations can be rolled back
    if (migration.status !== 'completed') {
      return NextResponse.json(
        { error: `Cannot rollback a migration with status "${migration.status}". Only completed migrations can be rolled back.` },
        { status: 400 }
      );
    }

    // Soft rollback: update status and set rolledBackAt
    // In a real system this would also delete the created records
    const rolledBack = await db.dataMigration.update({
      where: { id },
      data: {
        status: 'rolled_back',
        rolledBackAt: new Date(),
      },
    });

    // Create audit log for the rollback action
    await db.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        action: 'migration_rollback',
        details: `Rolled back data migration "${migration.fileName}" (ID: ${migration.id}) for ${migration.entityType}. ${migration.processedRows} rows were imported. Soft rollback - records may still exist in the system.`,
      },
    });

    return NextResponse.json({
      data: rolledBack,
      message: `Migration rolled back successfully. Note: This is a soft rollback. ${migration.processedRows} imported records may still exist in the system. Manual cleanup may be required.`,
    });
  } catch (error) {
    console.error('Rollback migration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
