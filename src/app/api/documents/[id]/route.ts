import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { unlink } from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-auth-tenant-id header is required' },
        { status: 400 },
      );
    }

    const { id } = await params;

    const document = await db.document.findFirst({
      where: { id, tenantId },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            qrCode: true,
            tagNumber: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: document });
  } catch (error) {
    console.error('Get document error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id');
    const userId = request.headers.get('x-auth-user-id');
    const role = request.headers.get('x-auth-role');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-auth-tenant-id header is required' },
        { status: 400 },
      );
    }

    const { id } = await params;

    const document = await db.document.findFirst({
      where: { id, tenantId },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      );
    }

    // Authorization: only admin/super_admin or the original uploader can delete
    if (role !== 'admin' && role !== 'super_admin' && document.uploadedBy !== userId) {
      return NextResponse.json(
        { error: 'Only administrators or the original uploader can delete this document' },
        { status: 403 },
      );
    }

    // Delete physical file from disk
    try {
      const absoluteFilePath = path.join(process.cwd(), 'uploads', document.fileUrl);
      await unlink(absoluteFilePath);
    } catch (fileError) {
      // Log file deletion error but continue with DB deletion
      console.warn(
        `Failed to delete physical file for document ${id}:`,
        fileError,
      );
    }

    // Delete document record from database
    await db.document.delete({
      where: { id },
    });

    return NextResponse.json({
      data: { id: document.id, deleted: true },
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('Delete document error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
