import { z } from 'zod';

// User role enum
export const userRoleSchema = z.enum(['admin', 'employee']);
export type UserRole = z.infer<typeof userRoleSchema>;

// User schemas
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  password_hash: z.string(),
  role: userRoleSchema,
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

export const createUserInputSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  role: userRoleSchema
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const updateUserInputSchema = z.object({
  id: z.number(),
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: userRoleSchema.optional(),
  is_active: z.boolean().optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Product schemas
export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  stock_quantity: z.number().int(),
  min_stock_level: z.number().int(),
  category: z.string().nullable(),
  sku: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Product = z.infer<typeof productSchema>;

export const createProductInputSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  price: z.number().positive(),
  stock_quantity: z.number().int().nonnegative(),
  min_stock_level: z.number().int().nonnegative().default(0),
  category: z.string().nullable(),
  sku: z.string().nullable()
});

export type CreateProductInput = z.infer<typeof createProductInputSchema>;

export const updateProductInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  price: z.number().positive().optional(),
  stock_quantity: z.number().int().nonnegative().optional(),
  min_stock_level: z.number().int().nonnegative().optional(),
  category: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;

// Customer schemas
export const customerSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Customer = z.infer<typeof customerSchema>;

export const createCustomerInputSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable()
});

export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>;

export const updateCustomerInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional()
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerInputSchema>;

// Transaction status enum
export const transactionStatusSchema = z.enum(['pending', 'completed', 'cancelled']);
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;

// Transaction schemas
export const transactionSchema = z.object({
  id: z.number(),
  customer_id: z.number().nullable(),
  user_id: z.number(),
  total_amount: z.number(),
  discount_amount: z.number(),
  final_amount: z.number(),
  status: transactionStatusSchema,
  payment_method: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Transaction = z.infer<typeof transactionSchema>;

export const createTransactionInputSchema = z.object({
  customer_id: z.number().nullable(),
  user_id: z.number(),
  total_amount: z.number().positive(),
  discount_amount: z.number().nonnegative().default(0),
  payment_method: z.string().nullable(),
  notes: z.string().nullable(),
  items: z.array(z.object({
    product_id: z.number(),
    quantity: z.number().int().positive(),
    unit_price: z.number().positive()
  }))
});

export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;

export const updateTransactionInputSchema = z.object({
  id: z.number(),
  customer_id: z.number().nullable().optional(),
  total_amount: z.number().positive().optional(),
  discount_amount: z.number().nonnegative().optional(),
  status: transactionStatusSchema.optional(),
  payment_method: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

export type UpdateTransactionInput = z.infer<typeof updateTransactionInputSchema>;

// Transaction Item schemas
export const transactionItemSchema = z.object({
  id: z.number(),
  transaction_id: z.number(),
  product_id: z.number(),
  quantity: z.number().int(),
  unit_price: z.number(),
  total_price: z.number(),
  created_at: z.coerce.date()
});

export type TransactionItem = z.infer<typeof transactionItemSchema>;

// Inventory Movement schemas
export const inventoryMovementTypeSchema = z.enum(['in', 'out', 'adjustment']);
export type InventoryMovementType = z.infer<typeof inventoryMovementTypeSchema>;

export const inventoryMovementSchema = z.object({
  id: z.number(),
  product_id: z.number(),
  movement_type: inventoryMovementTypeSchema,
  quantity: z.number().int(),
  reference_type: z.string().nullable(),
  reference_id: z.number().nullable(),
  notes: z.string().nullable(),
  created_at: z.coerce.date()
});

export type InventoryMovement = z.infer<typeof inventoryMovementSchema>;

export const createInventoryMovementInputSchema = z.object({
  product_id: z.number(),
  movement_type: inventoryMovementTypeSchema,
  quantity: z.number().int(),
  reference_type: z.string().nullable(),
  reference_id: z.number().nullable(),
  notes: z.string().nullable()
});

export type CreateInventoryMovementInput = z.infer<typeof createInventoryMovementInputSchema>;

// Report schemas
export const salesReportSchema = z.object({
  period: z.string(),
  total_transactions: z.number().int(),
  total_revenue: z.number(),
  total_discount: z.number(),
  top_products: z.array(z.object({
    product_id: z.number(),
    product_name: z.string(),
    quantity_sold: z.number().int(),
    revenue: z.number()
  }))
});

export type SalesReport = z.infer<typeof salesReportSchema>;

export const inventoryReportSchema = z.object({
  total_products: z.number().int(),
  low_stock_products: z.array(z.object({
    product_id: z.number(),
    product_name: z.string(),
    current_stock: z.number().int(),
    min_stock_level: z.number().int()
  })),
  out_of_stock_products: z.array(z.object({
    product_id: z.number(),
    product_name: z.string()
  })),
  total_inventory_value: z.number()
});

export type InventoryReport = z.infer<typeof inventoryReportSchema>;

export const reportPeriodSchema = z.object({
  start_date: z.string(),
  end_date: z.string()
});

export type ReportPeriod = z.infer<typeof reportPeriodSchema>;