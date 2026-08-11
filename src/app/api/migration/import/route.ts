import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/jwt';

// Simple CSV parser - handles quoted fields, newlines in quotes, and commas inside quotes
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ("")
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
        i++;
      } else if (char === '\r') {
        // Handle \r\n or just \r
        currentRow.push(currentField.trim());
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
        if (i < text.length && text[i] === '\n') {
          i++;
        }
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  // Handle last field/row if file doesn't end with newline
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  // Remove empty trailing rows
  while (rows.length > 0 && rows[rows.length - 1].every(cell => cell === '')) {
    rows.pop();
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  return { headers, rows: dataRows };
}

// Auto-detect mapping from CSV headers to target fields
function autoDetectMapping(
  csvHeaders: string[],
  entityType: string
): Record<string, string> {
  const fieldPatterns: Record<string, Record<string, string[]>> = {
    // Asset fields
    assets: {
      name: ['name', 'asset_name', 'asset name', 'item', 'item_name', 'item name', 'description', 'title'],
      description: ['description', 'desc', 'details', 'notes'],
      serialNumber: ['serial', 'serial_number', 'serial number', 'serialnumber', 'serial_no', 'serial no'],
      brand: ['brand', 'manufacturer', 'make', 'vendor'],
      model: ['model', 'model_number', 'model number', 'model_no'],
      purchaseDate: ['purchase_date', 'purchase date', 'date_purchased', 'date purchased', 'acquired_date', 'acquired', 'purchase_date'],
      purchasePrice: ['purchase_price', 'purchase price', 'cost', 'price', 'amount', 'value'],
      currentValue: ['current_value', 'current value', 'book_value', 'book value'],
      status: ['status', 'condition_status', 'asset_status'],
      condition: ['condition', 'physical_condition'],
      assignedTo: ['assigned_to', 'assigned to', 'assigned', 'user', 'custodian', 'responsible'],
      categoryId: ['category', 'category_id', 'category_name'],
      locationId: ['location', 'location_id', 'location_name', 'site', 'building'],
      tagNumber: ['tag', 'tag_number', 'tag number', 'tag_no', 'asset_tag', 'asset_tag_number', 'barcode'],
    },
    // Category fields
    categories: {
      name: ['name', 'category_name', 'category name'],
      code: ['code', 'category_code', 'category code'],
      color: ['color', 'hex'],
      icon: ['icon'],
    },
    // Location fields
    locations: {
      name: ['name', 'location_name', 'location name', 'site_name'],
      code: ['code', 'location_code', 'location code'],
      address: ['address', 'location_address'],
    },
    // User fields
    users: {
      name: ['name', 'full_name', 'full name', 'display_name'],
      email: ['email', 'email_address', 'email address'],
      role: ['role', 'user_role', 'position', 'job_title'],
      phone: ['phone', 'phone_number', 'phone number', 'mobile', 'telephone'],
      department: ['department', 'dept'],
      jobTitle: ['job_title', 'job title', 'title', 'position'],
    },
  };

  const patterns = fieldPatterns[entityType] as Record<string, string[]> | undefined;
  if (!patterns) return {};

  const mapping: Record<string, string> = {};

  for (const csvHeader of csvHeaders) {
    const lowerHeader = csvHeader.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');

    for (const [targetField, keywords] of Object.entries(patterns)) {
      if (mapping[targetField]) continue; // Already mapped
      if (keywords.some(kw => kw === lowerHeader || kw.replace(/_/g, ' ') === csvHeader.toLowerCase())) {
        mapping[targetField] = csvHeader;
      }
    }
  }

  return mapping;
}

function generateQRCode(): string {
  const timestamp = Date.now();
  const random4 = Math.floor(1000 + Math.random() * 9000);
  return `AST-${timestamp}-${random4}`;
}

function generateTagNumber(): string {
  const prefix = 'IMP';
  const ts = Date.now().toString(36).toUpperCase();
  const random = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${ts}-${random}`;
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-auth-tenant-id');
    const userId = request.headers.get('x-auth-user-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'x-auth-tenant-id header is required' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const entityType = formData.get('entityType') as string | null;
    const mappingConfigRaw = formData.get('mappingConfig') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    if (!entityType || !['assets', 'categories', 'locations', 'users'].includes(entityType)) {
      return NextResponse.json(
        { error: 'entityType must be one of: assets, categories, locations, users' },
        { status: 400 }
      );
    }

    // Validate entity type permissions
    if (entityType === 'users') {
      const role = request.headers.get('x-auth-role');
      if (role !== 'admin') {
        return NextResponse.json(
          { error: 'Only admins can import users' },
          { status: 403 }
        );
      }
    }

    const fileName = file.name;
    const fileSize = file.size;
    const fileExt = fileName.split('.').pop()?.toLowerCase() || '';

    // Check if it's an Excel file
    if (['xlsx', 'xls'].includes(fileExt)) {
      // Create a pending migration record for Excel (requires xlsx processing)
      const migration = await db.dataMigration.create({
        data: {
          tenantId,
          sourceType: 'excel',
          entityType,
          fileName,
          fileSize,
          totalRows: 0,
          status: 'pending',
          mappingConfig: mappingConfigRaw || '{}',
          createdBy: userId || null,
          errors: JSON.stringify([
            'Excel import requires xlsx library processing. Please convert to CSV and try again.',
          ]),
        },
      });

      return NextResponse.json(
        {
          data: migration,
          message:
            'Excel import is pending. CSV format is recommended for direct import. Excel files require additional processing.',
        },
        { status: 201 }
      );
    }

    if (fileExt !== 'csv') {
      return NextResponse.json(
        { error: 'Only CSV and Excel files are supported' },
        { status: 400 }
      );
    }

    // Read and parse CSV
    const fileBuffer = await file.arrayBuffer();
    const fileText = new TextDecoder('utf-8').decode(fileBuffer);

    const { headers, rows } = parseCSV(fileText);

    if (headers.length === 0 || rows.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty or has no data rows' },
        { status: 400 }
      );
    }

    // Parse or auto-detect mapping config
    let mappingConfig: Record<string, string> = {};
    if (mappingConfigRaw) {
      try {
        mappingConfig = JSON.parse(mappingConfigRaw);
      } catch {
        return NextResponse.json(
          { error: 'mappingConfig must be valid JSON' },
          { status: 400 }
        );
      }
    } else {
      mappingConfig = autoDetectMapping(headers, entityType);
    }

    // Create DataMigration record with processing status
    const migration = await db.dataMigration.create({
      data: {
        tenantId,
        sourceType: 'csv',
        entityType,
        fileName,
        fileSize,
        totalRows: rows.length,
        status: 'processing',
        mappingConfig: JSON.stringify(mappingConfig),
        startedAt: new Date(),
        createdBy: userId || null,
        errors: '[]',
      },
    });

    // Process rows in batches of 100
    const BATCH_SIZE = 100;
    let processedRows = 0;
    let failedRows = 0;
    const errors: { row: number; message: string; data?: Record<string, string> }[] = [];

    for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
      const batch = rows.slice(batchStart, batchStart + BATCH_SIZE);

      for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
        const rawRow = batch[rowIdx];
        const rowNumber = batchStart + rowIdx + 2; // +2 for header row + 1-indexed

        // Map CSV columns to field values using mapping config
        const mappedData: Record<string, string> = {};
        for (const [targetField, sourceCol] of Object.entries(mappingConfig)) {
          const colIndex = headers.indexOf(sourceCol);
          if (colIndex !== -1 && colIndex < rawRow.length) {
            mappedData[targetField] = rawRow[colIndex];
          }
        }

        try {
          switch (entityType) {
            case 'assets':
              await importAsset(mappedData, tenantId);
              break;
            case 'categories':
              await importCategory(mappedData, tenantId);
              break;
            case 'locations':
              await importLocation(mappedData, tenantId);
              break;
            case 'users':
              await importUser(mappedData, tenantId);
              break;
          }
          processedRows++;
        } catch (error) {
          failedRows++;
          errors.push({
            row: rowNumber,
            message: error instanceof Error ? error.message : 'Unknown error',
            data: mappedData,
          });
        }
      }
    }

    // Update migration record with final status
    const finalStatus = failedRows === rows.length && processedRows === 0 ? 'failed' : 'completed';
    const updatedMigration = await db.dataMigration.update({
      where: { id: migration.id },
      data: {
        status: finalStatus,
        processedRows,
        failedRows,
        errors: JSON.stringify(errors.slice(0, 500)), // Cap error storage
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ data: updatedMigration }, { status: 201 });
  } catch (error) {
    console.error('Migration import error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function importAsset(data: Record<string, string>, tenantId: string): Promise<void> {
  if (!data.name) {
    throw new Error('Asset name is required');
  }

  // Try to resolve categoryId from name/code
  let categoryId: string | undefined;
  if (data.categoryId) {
    const category = await db.category.findFirst({
      where: {
        tenantId,
        OR: [
          { name: { contains: data.categoryId } },
          { code: { equals: data.categoryId } },
        ],
      },
    });
    if (category) categoryId = category.id;
  }

  // Try to resolve locationId from name/code
  let locationId: string | undefined;
  if (data.locationId) {
    const location = await db.location.findFirst({
      where: {
        tenantId,
        OR: [
          { name: { contains: data.locationId } },
          { code: { equals: data.locationId } },
        ],
      },
    });
    if (location) locationId = location.id;
  }

  // Generate QR code and tag number if not provided
  const qrCode = generateQRCode();
  const tagNumber = data.tagNumber || generateTagNumber();

  await db.asset.create({
    data: {
      qrCode,
      tagNumber,
      name: data.name,
      description: data.description || null,
      serialNumber: data.serialNumber || null,
      brand: data.brand || null,
      model: data.model || null,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
      purchasePrice: data.purchasePrice ? parseFloat(data.purchasePrice) : null,
      currentValue: data.currentValue ? parseFloat(data.currentValue) : null,
      warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry) : null,
      status: data.status || 'active',
      condition: data.condition || 'good',
      assignedTo: data.assignedTo || null,
      categoryId,
      locationId,
      tenantId,
    },
  });
}

async function importCategory(data: Record<string, string>, tenantId: string): Promise<void> {
  if (!data.name) {
    throw new Error('Category name is required');
  }

  const code = data.code || data.name.replace(/\s+/g, '_').substring(0, 10).toUpperCase();

  await db.category.create({
    data: {
      name: data.name,
      code,
      color: data.color || '#6366f1',
      icon: data.icon || 'Package',
      tenantId,
    },
  });
}

async function importLocation(data: Record<string, string>, tenantId: string): Promise<void> {
  if (!data.name) {
    throw new Error('Location name is required');
  }

  const code = data.code || data.name.replace(/\s+/g, '-').substring(0, 10).toUpperCase();

  await db.location.create({
    data: {
      name: data.name,
      code,
      address: data.address || null,
      tenantId,
    },
  });
}

async function importUser(data: Record<string, string>, tenantId: string): Promise<void> {
  if (!data.name || !data.email) {
    throw new Error('User name and email are required');
  }

  // Use bcrypt hash for password (default: changeme)
  const passwordHash = hashPassword('changeme');

  await db.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role || 'user',
      phone: data.phone || null,
      department: data.department || null,
      jobTitle: data.jobTitle || null,
      tenantId,
    },
  });
}
