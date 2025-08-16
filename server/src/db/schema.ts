import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean, 
  pgEnum,
  index
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'employee']);
export const transactionStatusEnum = pgEnum('transaction_status', ['pending', 'completed', 'cancelled']);
export const inventoryMovementTypeEnum = pgEnum('inventory_movement_type', ['in', 'out', 'adjustment']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  usernameIdx: index('users_username_idx').on(table.username),
}));

// Products table
export const productsTable = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  stock_quantity: integer('stock_quantity').notNull().default(0),
  min_stock_level: integer('min_stock_level').notNull().default(0),
  category: text('category'),
  sku: text('sku').unique(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: index('products_name_idx').on(table.name),
  categoryIdx: index('products_category_idx').on(table.category),
  skuIdx: index('products_sku_idx').on(table.sku),
  stockIdx: index('products_stock_idx').on(table.stock_quantity),
}));

// Customers table
export const customersTable = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: index('customers_name_idx').on(table.name),
  emailIdx: index('customers_email_idx').on(table.email),
}));

// Transactions table
export const transactionsTable = pgTable('transactions', {
  id: serial('id').primaryKey(),
  customer_id: integer('customer_id'),
  user_id: integer('user_id').notNull(),
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  discount_amount: numeric('discount_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  final_amount: numeric('final_amount', { precision: 10, scale: 2 }).notNull(),
  status: transactionStatusEnum('status').notNull().default('pending'),
  payment_method: text('payment_method'),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  customerIdx: index('transactions_customer_idx').on(table.customer_id),
  userIdx: index('transactions_user_idx').on(table.user_id),
  statusIdx: index('transactions_status_idx').on(table.status),
  createdAtIdx: index('transactions_created_at_idx').on(table.created_at),
}));

// Transaction Items table
export const transactionItemsTable = pgTable('transaction_items', {
  id: serial('id').primaryKey(),
  transaction_id: integer('transaction_id').notNull(),
  product_id: integer('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  total_price: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  transactionIdx: index('transaction_items_transaction_idx').on(table.transaction_id),
  productIdx: index('transaction_items_product_idx').on(table.product_id),
}));

// Inventory Movements table
export const inventoryMovementsTable = pgTable('inventory_movements', {
  id: serial('id').primaryKey(),
  product_id: integer('product_id').notNull(),
  movement_type: inventoryMovementTypeEnum('movement_type').notNull(),
  quantity: integer('quantity').notNull(),
  reference_type: text('reference_type'), // 'transaction', 'adjustment', etc.
  reference_id: integer('reference_id'), // ID of the related record
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  productIdx: index('inventory_movements_product_idx').on(table.product_id),
  typeIdx: index('inventory_movements_type_idx').on(table.movement_type),
  createdAtIdx: index('inventory_movements_created_at_idx').on(table.created_at),
}));

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  transactions: many(transactionsTable),
}));

export const customersRelations = relations(customersTable, ({ many }) => ({
  transactions: many(transactionsTable),
}));

export const productsRelations = relations(productsTable, ({ many }) => ({
  transactionItems: many(transactionItemsTable),
  inventoryMovements: many(inventoryMovementsTable),
}));

export const transactionsRelations = relations(transactionsTable, ({ one, many }) => ({
  customer: one(customersTable, {
    fields: [transactionsTable.customer_id],
    references: [customersTable.id],
  }),
  user: one(usersTable, {
    fields: [transactionsTable.user_id],
    references: [usersTable.id],
  }),
  items: many(transactionItemsTable),
}));

export const transactionItemsRelations = relations(transactionItemsTable, ({ one }) => ({
  transaction: one(transactionsTable, {
    fields: [transactionItemsTable.transaction_id],
    references: [transactionsTable.id],
  }),
  product: one(productsTable, {
    fields: [transactionItemsTable.product_id],
    references: [productsTable.id],
  }),
}));

export const inventoryMovementsRelations = relations(inventoryMovementsTable, ({ one }) => ({
  product: one(productsTable, {
    fields: [inventoryMovementsTable.product_id],
    references: [productsTable.id],
  }),
}));

// TypeScript types for table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type Product = typeof productsTable.$inferSelect;
export type NewProduct = typeof productsTable.$inferInsert;
export type Customer = typeof customersTable.$inferSelect;
export type NewCustomer = typeof customersTable.$inferInsert;
export type Transaction = typeof transactionsTable.$inferSelect;
export type NewTransaction = typeof transactionsTable.$inferInsert;
export type TransactionItem = typeof transactionItemsTable.$inferSelect;
export type NewTransactionItem = typeof transactionItemsTable.$inferInsert;
export type InventoryMovement = typeof inventoryMovementsTable.$inferSelect;
export type NewInventoryMovement = typeof inventoryMovementsTable.$inferInsert;

// Export all tables for proper query building
export const tables = {
  users: usersTable,
  products: productsTable,
  customers: customersTable,
  transactions: transactionsTable,
  transactionItems: transactionItemsTable,
  inventoryMovements: inventoryMovementsTable,
};