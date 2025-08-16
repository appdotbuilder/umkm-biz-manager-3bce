import { db } from '../db';
import { customersTable, transactionsTable, transactionItemsTable, productsTable } from '../db/schema';
import { type Customer } from '../schema';
import { eq, or, ilike, desc, and, type SQL } from 'drizzle-orm';

export interface GetCustomersFilters {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CustomerPurchaseHistory {
  id: number;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  status: string;
  payment_method: string | null;
  created_at: Date;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

export async function getCustomers(filters: GetCustomersFilters = {}): Promise<Customer[]> {
  try {
    const { search, limit = 50, offset = 0 } = filters;

    const conditions: SQL<unknown>[] = [];

    if (search) {
      conditions.push(
        or(
          ilike(customersTable.name, `%${search}%`),
          ilike(customersTable.email, `%${search}%`),
          ilike(customersTable.phone, `%${search}%`)
        )!
      );
    }

    const baseQuery = db.select().from(customersTable);

    const results = conditions.length > 0
      ? await baseQuery
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(customersTable.created_at))
          .limit(limit)
          .offset(offset)
          .execute()
      : await baseQuery
          .orderBy(desc(customersTable.created_at))
          .limit(limit)
          .offset(offset)
          .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch customers:', error);
    throw error;
  }
}

export async function getCustomerById(id: number): Promise<Customer | null> {
  try {
    const results = await db.select()
      .from(customersTable)
      .where(eq(customersTable.id, id))
      .execute();

    return results[0] || null;
  } catch (error) {
    console.error('Failed to fetch customer by ID:', error);
    throw error;
  }
}

export async function getCustomerPurchaseHistory(customerId: number): Promise<CustomerPurchaseHistory[]> {
  try {
    // First, get all transactions for the customer
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.customer_id, customerId))
      .orderBy(desc(transactionsTable.created_at))
      .execute();

    // For each transaction, get the items with product details
    const historyWithItems = await Promise.all(
      transactions.map(async (transaction) => {
        const items = await db.select({
          product_name: productsTable.name,
          quantity: transactionItemsTable.quantity,
          unit_price: transactionItemsTable.unit_price,
          total_price: transactionItemsTable.total_price
        })
          .from(transactionItemsTable)
          .innerJoin(productsTable, eq(transactionItemsTable.product_id, productsTable.id))
          .where(eq(transactionItemsTable.transaction_id, transaction.id))
          .execute();

        return {
          id: transaction.id,
          total_amount: parseFloat(transaction.total_amount),
          discount_amount: parseFloat(transaction.discount_amount),
          final_amount: parseFloat(transaction.final_amount),
          status: transaction.status,
          payment_method: transaction.payment_method,
          created_at: transaction.created_at,
          items: items.map(item => ({
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: parseFloat(item.unit_price),
            total_price: parseFloat(item.total_price)
          }))
        };
      })
    );

    return historyWithItems;
  } catch (error) {
    console.error('Failed to fetch customer purchase history:', error);
    throw error;
  }
}