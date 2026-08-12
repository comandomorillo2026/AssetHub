import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
  tenantName: z.string().min(2, 'Tenant name is required').max(100),
  tenantType: z.enum(['government', 'corporate', 'nonprofit', 'education', 'healthcare']),
  contactName: z.string().min(2, 'Contact name is required'),
  contactEmail: z.string().email('Invalid email'),
  contactPhone: z.string().min(7, 'Phone number is required'),
  country: z.string().min(2, 'Country is required'),
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  planSlug: z.string().optional(),
});

export const assetCreateSchema = z.object({
  name: z.string().min(1, 'Asset name is required').max(200),
  description: z.string().max(2000).optional(),
  serialNumber: z.string().max(100).optional(),
  brand: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  tagNumber: z.string().max(50).optional(),
  status: z.enum(['active', 'inactive', 'in_repair', 'disposed', 'lost', 'pending']).optional().default('active'),
  condition: z.enum(['new', 'good', 'fair', 'poor', 'damaged']).optional().default('new'),
  assignedTo: z.string().max(200).optional(),
  purchaseDate: z.string().datetime().or(z.date()).optional(),
  purchasePrice: z.number().min(0).optional(),
  currentValue: z.number().min(0).optional(),
  warrantyExpiry: z.string().datetime().or(z.date()).optional(),
  categoryId: z.string().min(1, 'Category is required'),
  locationId: z.string().min(1, 'Location is required'),
  notes: z.string().max(5000).optional(),
});

export const assetUpdateSchema = assetCreateSchema.partial();

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  code: z.string().min(1, 'Category code is required').max(20),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  icon: z.string().max(50).optional(),
});

export const locationSchema = z.object({
  name: z.string().min(1, 'Location name is required').max(200),
  code: z.string().min(1, 'Location code is required').max(20),
  address: z.string().max(500).optional(),
  parentId: z.string().optional(),
});

export const maintenanceCreateSchema = z.object({
  assetId: z.string().min(1, 'Asset ID is required'),
  type: z.enum(['preventive', 'corrective', 'emergency']),
  description: z.string().min(1, 'Description is required').max(2000),
  scheduledDate: z.string().datetime().or(z.date()).optional(),
  cost: z.number().min(0).optional(),
  vendor: z.string().max(200).optional(),
});

export function validateBody<T>(schema: z.ZodType<T>, body: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body);
  if (result.success) return { success: true, data: result.data };
  const firstError = result.error.issues[0];
  return { success: false, error: firstError?.message || 'Invalid request data' };
}
