import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readFile } from 'fs/promises';
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
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      );
    }

    // Read the physical file from disk
    const absoluteFilePath = path.join(process.cwd(), 'uploads', document.fileUrl);

    let fileBuffer: Buffer;
    try {
      fileBuffer = await readFile(absoluteFilePath);
    } catch {
      return NextResponse.json(
        { error: 'File not found on disk. It may have been moved or deleted.' },
        { status: 410 },
      );
    }

    // Build Content-Disposition with the original file name
    const encodedFileName = encodeURIComponent(document.originalName);

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': document.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFileName}`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Download document error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
