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
  status: z.enum(['active', 'inactive', 'in_repair', 'disposed', 'lost', 'pending', 'checked_out']).optional().default('active'),
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

export const checkoutCreateSchema = z.object({
  assetId: z.string().min(1, 'Asset ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  expectedReturnAt: z.string().datetime().or(z.date()).optional(),
  conditionAtCheckout: z.enum(['new', 'good', 'fair', 'poor', 'damaged']).optional(),
  notes: z.string().max(5000).optional(),
});

export const checkoutReturnSchema = z.object({
  conditionAtReturn: z.enum(['new', 'good', 'fair', 'poor', 'damaged']).optional(),
  notes: z.string().max(5000).optional(),
});

export const reservationCreateSchema = z.object({
  assetId: z.string().min(1, 'Asset ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  purpose: z.string().max(2000).optional(),
  startDate: z.string().datetime().or(z.date()),
  endDate: z.string().datetime().or(z.date()),
  notes: z.string().max(5000).optional(),
});

export const reservationUpdateSchema = z.object({
 purpose: z.string().max(2000).optional(),
  startDate: z.string().datetime().or(z.date()).optional(),
  endDate: z.string().datetime().or(z.date()).optional(),
  notes: z.string().max(5000).optional(),
});

export function validateBody<T>(schema: z.ZodType<T>, body: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body);
  if (result.success) return { success: true, data: result.data };
  const firstError = result.error.issues[0];
  return { success: false, error: firstError?.message || 'Invalid request data' };
}

export const workOrderCreateSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  assetId: z.string().optional(),
  locationId: z.string().optional(),
  dueDate: z.string().datetime().optional().transform(d => d ? new Date(d) : undefined),
  estimatedCost: z.number().nonnegative().optional(),
})

export const workOrderUpdateSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assetId: z.string().optional(),
  locationId: z.string().optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().datetime().optional().transform(d => d ? new Date(d) : undefined),
  estimatedCost: z.number().nonnegative().optional(),
  actualCost: z.number().nonnegative().optional(),
})

export const workOrderApproveSchema = z.object({
  notes: z.string().optional(),
})

export const workOrderRejectSchema = z.object({
  reason: z.string().min(5, 'Please provide a reason for rejection'),
})

export const userCreateSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  role: z.enum(['admin', 'auditor', 'user']).default('user'),
  phone: z.string().optional(),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
})

export const userUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(['admin', 'auditor', 'user']).optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
  isActive: z.boolean().optional(),
  avatar: z.string().optional(),
})

export const passwordResetSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
})
