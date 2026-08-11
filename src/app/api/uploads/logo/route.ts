import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'svg', 'webp'];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'logos');

export async function POST(request: NextRequest) {
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

    // Only admins can upload logos
    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can upload tenant logos' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // Validate file extension
    const fileName = file.name;
    const fileExt = fileName.split('.').pop()?.toLowerCase() || '';

    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate MIME type for extra security
    const allowedMimeTypes = [
      'image/png',
      'image/jpeg',
      'image/svg+xml',
      'image/webp',
    ];

    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid MIME type. Only image files are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 2MB limit' },
        { status: 400 }
      );
    }

    // Verify tenant exists
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const safeFileName = `${tenantId}-${timestamp}.${fileExt}`;
    const filePath = path.join(UPLOAD_DIR, safeFileName);
    const publicPath = `/uploads/logos/${safeFileName}`;

    // Write file to disk
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // Update or create TenantSettings with the logo URL
    const settings = await db.tenantSettings.upsert({
      where: { tenantId },
      update: { logoUrl: publicPath },
      create: {
        tenantId,
        logoUrl: publicPath,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        tenantId,
        userId: userId || null,
        action: 'logo_updated',
        details: `Tenant logo uploaded: ${fileName} -> ${publicPath}`,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({
      logoUrl: publicPath,
      fileName: safeFileName,
      message: 'Logo uploaded successfully',
    });
  } catch (error) {
    console.error('Logo upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
