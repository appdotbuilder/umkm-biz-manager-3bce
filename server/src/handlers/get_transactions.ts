import { db } from '../db';
import { 
  transactionsTable, 
  transactionItemsTable, 
  productsTable, 
  customersTable, 
  usersTable 
} from '../db/schema';
import { type Transaction } from '../schema';
import { eq, gte, lte, and, desc, SQL } from 'drizzle-orm';

export interface GetTransactionsFilters {
  customer_id?: number;
  user_id?: number;
  status?: 'pending' | 'completed' | 'cancelled';
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface TransactionWithDetails {
  id: number;
  customer_id: number | null;
  user_id: number;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  status: 'pending' | 'completed' | 'cancelled';
  payment_method: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  customer?: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  user: {
    id: number;
    username: string;
    email: string;
    role: 'admin' | 'employee';
  };
  items: {
    id: number;
    product_id: number;
    quantity: number;
    unit_price: number;
    total_price: number;
    product: {
      id: number;
      name: string;
      description: string | null;
      price: number;
      sku: string | null;
    };
  }[];
}

export async function getTransactions(filters: GetTransactionsFilters = {}): Promise<Transaction[]> {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    if (filters.customer_id !== undefined) {
      conditions.push(eq(transactionsTable.customer_id, filters.customer_id));
    }

    if (filters.user_id !== undefined) {
      conditions.push(eq(transactionsTable.user_id, filters.user_id));
    }

    if (filters.status !== undefined) {
      conditions.push(eq(transactionsTable.status, filters.status));
    }

    if (filters.start_date !== undefined) {
      const startDate = new Date(filters.start_date);
      conditions.push(gte(transactionsTable.created_at, startDate));
    }

    if (filters.end_date !== undefined) {
      const endDate = new Date(filters.end_date);
      conditions.push(lte(transactionsTable.created_at, endDate));
    }

    // Build the complete query in one chain to avoid type issues
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    let baseQuery = db.select()
      .from(transactionsTable)
      .orderBy(desc(transactionsTable.created_at))
      .limit(limit)
      .offset(offset);

    // Apply where clause if conditions exist
    const results = conditions.length > 0 
      ? await baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions)).execute()
      : await baseQuery.execute();

    // Convert numeric fields back to numbers
    return results.map(transaction => ({
      ...transaction,
      total_amount: parseFloat(transaction.total_amount),
      discount_amount: parseFloat(transaction.discount_amount),
      final_amount: parseFloat(transaction.final_amount)
    }));
  } catch (error) {
    console.error('Failed to get transactions:', error);
    throw error;
  }
}

export async function getTransactionById(id: number): Promise<TransactionWithDetails | null> {
  try {
    // Get transaction with customer and user details
    const transactionQuery = db.select({
      transaction: transactionsTable,
      customer: customersTable,
      user: {
        id: usersTable.id,
        username: usersTable.username,
        email: usersTable.email,
        role: usersTable.role
      }
    })
    .from(transactionsTable)
    .innerJoin(usersTable, eq(transactionsTable.user_id, usersTable.id))
    .leftJoin(customersTable, eq(transactionsTable.customer_id, customersTable.id))
    .where(eq(transactionsTable.id, id));

    const transactionResult = await transactionQuery.execute();

    if (transactionResult.length === 0) {
      return null;
    }

    const result = transactionResult[0];

    // Get transaction items with product details
    const itemsQuery = db.select({
      item: transactionItemsTable,
      product: {
        id: productsTable.id,
        name: productsTable.name,
        description: productsTable.description,
        price: productsTable.price,
        sku: productsTable.sku
      }
    })
    .from(transactionItemsTable)
    .innerJoin(productsTable, eq(transactionItemsTable.product_id, productsTable.id))
    .where(eq(transactionItemsTable.transaction_id, id));

    const itemsResult = await itemsQuery.execute();

    // Build the complete transaction object
    const transaction: TransactionWithDetails = {
      ...result.transaction,
      total_amount: parseFloat(result.transaction.total_amount),
      discount_amount: parseFloat(result.transaction.discount_amount),
      final_amount: parseFloat(result.transaction.final_amount),
      customer: result.customer ? {
        id: result.customer.id,
        name: result.customer.name,
        email: result.customer.email,
        phone: result.customer.phone,
        address: result.customer.address
      } : null,
      user: result.user,
      items: itemsResult.map(itemResult => ({
        ...itemResult.item,
        unit_price: parseFloat(itemResult.item.unit_price),
        total_price: parseFloat(itemResult.item.total_price),
        product: {
          ...itemResult.product,
          price: parseFloat(itemResult.product.price)
        }
      }))
    };

    return transaction;
  } catch (error) {
    console.error('Failed to get transaction by id:', error);
    throw error;
  }
}

export async function getTransactionsByDateRange(startDate: string, endDate: string): Promise<Transaction[]> {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const results = await db.select()
      .from(transactionsTable)
      .where(
        and(
          gte(transactionsTable.created_at, start),
          lte(transactionsTable.created_at, end)
        )
      )
      .orderBy(desc(transactionsTable.created_at))
      .execute();

    // Convert numeric fields back to numbers
    return results.map(transaction => ({
      ...transaction,
      total_amount: parseFloat(transaction.total_amount),
      discount_amount: parseFloat(transaction.discount_amount),
      final_amount: parseFloat(transaction.final_amount)
    }));
  } catch (error) {
    console.error('Failed to get transactions by date range:', error);
    throw error;
  }
}