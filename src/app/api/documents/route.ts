import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const VALID_CATEGORIES = [
  'invoice',
  'warranty',
  'manual',
  'photo',
  'contract',
  'insurance',
  'other',
] as const;

// Map common MIME types to extensions for file storage
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/zip': 'zip',
  'application/json': 'json',
};

function getExtension(mimeType: string, originalName: string): string {
  if (MIME_EXTENSIONS[mimeType]) {
    return MIME_EXTENSIONS[mimeType];
  }
  // Fallback: extract from original name
  const parts = originalName.split('.');
  if (parts.length > 1) {
    return parts.pop()!;
  }
  return 'bin';
}

function sanitizeFileName(name: string): string {
  // Remove or replace dangerous characters
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-auth-tenant-id header is required' },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');
    const category = searchParams.get('category');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = { tenantId };

    if (assetId) {
      where.assetId = assetId;
    }

    if (category) {
      if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
        return NextResponse.json(
          {
            error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
          },
          { status: 400 },
        );
      }
      where.category = category;
    }

    const [documents, total] = await Promise.all([
      db.document.findMany({
        where,
        skip: offset,
        take: limit,
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
        orderBy: { createdAt: 'desc' },
      }),
      db.document.count({ where }),
    ]);

    return NextResponse.json({
      data: documents,
      pagination: {
        limit,
        offset,
        total,
      },
    });
  } catch (error) {
    console.error('List documents error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id');
    const userId = request.headers.get('x-auth-user-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-auth-tenant-id header is required' },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const assetId = formData.get('assetId') as string | null;
    const category = (formData.get('category') as string) || 'other';
    const description = (formData.get('description') as string) || null;

    // Validate file
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    // Validate file size (50MB max)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds the 50MB limit' },
        { status: 400 },
      );
    }

    // Validate category
    if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
      return NextResponse.json(
        {
          error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // Validate assetId if provided
    if (assetId) {
      const asset = await db.asset.findFirst({
        where: { id: assetId, tenantId },
      });
      if (!asset) {
        return NextResponse.json(
          { error: 'Asset not found or does not belong to your organization' },
          { status: 404 },
        );
      }
    }

    // Build file path: uploads/{tenantId}/{year}/{month}/{timestamp}-{originalName}
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const timestamp = Date.now();
    const extension = getExtension(file.type, file.name);
    const safeOriginalName = sanitizeFileName(file.name);
    const storedFileName = `${timestamp}-${safeOriginalName}`;

    const relativeDir = path.join(tenantId, year, month);
    const absoluteDir = path.join(process.cwd(), 'uploads', relativeDir);
    const absoluteFilePath = path.join(absoluteDir, storedFileName);

    // Ensure directory exists
    await mkdir(absoluteDir, { recursive: true });

    // Write file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(absoluteFilePath, buffer);

    const fileUrl = path.join(relativeDir, storedFileName);

    // Create document record
    const document = await db.document.create({
      data: {
        tenantId,
        assetId: assetId || null,
        fileName: storedFileName,
        originalName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        fileUrl,
        category,
        description,
        uploadedBy: userId || null,
      },
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

    return NextResponse.json({ data: document }, { status: 201 });
  } catch (error) {
    console.error('Upload document error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
