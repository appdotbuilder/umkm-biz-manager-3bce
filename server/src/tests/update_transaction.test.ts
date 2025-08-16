import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  customersTable, 
  productsTable, 
  transactionsTable, 
  transactionItemsTable,
  inventoryMovementsTable 
} from '../db/schema';
import { type UpdateTransactionInput } from '../schema';
import { updateTransaction } from '../handlers/update_transaction';
import { eq, sql } from 'drizzle-orm';

describe('updateTransaction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test data
  async function createTestData() {
    // Create user
    const user = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        role: 'employee'
      })
      .returning()
      .execute();

    // Create customer
    const customer = await db.insert(customersTable)
      .values({
        name: 'Test Customer',
        email: 'customer@example.com',
        phone: '123-456-7890',
        address: '123 Test St'
      })
      .returning()
      .execute();

    // Create products
    const product1 = await db.insert(productsTable)
      .values({
        name: 'Test Product 1',
        description: 'Description 1',
        price: '19.99',
        stock_quantity: 100,
        min_stock_level: 10,
        category: 'Electronics'
      })
      .returning()
      .execute();

    const product2 = await db.insert(productsTable)
      .values({
        name: 'Test Product 2',
        description: 'Description 2',
        price: '29.99',
        stock_quantity: 50,
        min_stock_level: 5,
        category: 'Electronics'
      })
      .returning()
      .execute();

    // Create transaction
    const transaction = await db.insert(transactionsTable)
      .values({
        customer_id: customer[0].id,
        user_id: user[0].id,
        total_amount: '59.98',
        discount_amount: '5.00',
        final_amount: '54.98',
        status: 'pending',
        payment_method: 'cash',
        notes: 'Test transaction'
      })
      .returning()
      .execute();

    // Create transaction items
    await db.insert(transactionItemsTable)
      .values([
        {
          transaction_id: transaction[0].id,
          product_id: product1[0].id,
          quantity: 1,
          unit_price: '19.99',
          total_price: '19.99'
        },
        {
          transaction_id: transaction[0].id,
          product_id: product2[0].id,
          quantity: 1,
          unit_price: '29.99',
          total_price: '29.99'
        }
      ])
      .execute();

    return {
      user: user[0],
      customer: customer[0],
      product1: product1[0],
      product2: product2[0],
      transaction: transaction[0]
    };
  }

  it('should update basic transaction fields', async () => {
    const testData = await createTestData();

    const updateInput: UpdateTransactionInput = {
      id: testData.transaction.id,
      payment_method: 'credit_card',
      notes: 'Updated notes',
      discount_amount: 10.00
    };

    const result = await updateTransaction(updateInput);

    expect(result.id).toEqual(testData.transaction.id);
    expect(result.payment_method).toEqual('credit_card');
    expect(result.notes).toEqual('Updated notes');
    expect(result.discount_amount).toEqual(10.00);
    expect(result.final_amount).toEqual(49.98); // 59.98 - 10.00
    expect(typeof result.final_amount).toBe('number');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should recalculate final_amount when total_amount is updated', async () => {
    const testData = await createTestData();

    const updateInput: UpdateTransactionInput = {
      id: testData.transaction.id,
      total_amount: 100.00
    };

    const result = await updateTransaction(updateInput);

    expect(result.total_amount).toEqual(100.00);
    expect(result.final_amount).toEqual(95.00); // 100.00 - 5.00 (original discount)
    expect(typeof result.total_amount).toBe('number');
    expect(typeof result.final_amount).toBe('number');
  });

  it('should update customer_id to null', async () => {
    const testData = await createTestData();

    const updateInput: UpdateTransactionInput = {
      id: testData.transaction.id,
      customer_id: null
    };

    const result = await updateTransaction(updateInput);

    expect(result.customer_id).toBeNull();
  });

  it('should update status without inventory changes for non-critical transitions', async () => {
    const testData = await createTestData();

    const updateInput: UpdateTransactionInput = {
      id: testData.transaction.id,
      status: 'completed'
    };

    const result = await updateTransaction(updateInput);

    expect(result.status).toEqual('completed');

    // Check that product stock wasn't affected (since we don't handle pending->completed inventory changes)
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, testData.product1.id))
      .execute();

    expect(products[0].stock_quantity).toEqual(100); // Original stock unchanged
  });

  it('should restore inventory when changing from completed to cancelled', async () => {
    const testData = await createTestData();

    // First set transaction to completed
    await db.update(transactionsTable)
      .set({ status: 'completed' })
      .where(eq(transactionsTable.id, testData.transaction.id))
      .execute();

    // Simulate that inventory was reduced when completed (manually adjust for test)
    await db.update(productsTable)
      .set({ stock_quantity: 99 }) // Reduced by 1 for product1
      .where(eq(productsTable.id, testData.product1.id))
      .execute();

    await db.update(productsTable)
      .set({ stock_quantity: 49 }) // Reduced by 1 for product2
      .where(eq(productsTable.id, testData.product2.id))
      .execute();

    const updateInput: UpdateTransactionInput = {
      id: testData.transaction.id,
      status: 'cancelled'
    };

    const result = await updateTransaction(updateInput);

    expect(result.status).toEqual('cancelled');

    // Check that inventory was restored
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, testData.product1.id))
      .execute();

    expect(products[0].stock_quantity).toEqual(100); // Stock restored

    const products2 = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, testData.product2.id))
      .execute();

    expect(products2[0].stock_quantity).toEqual(50); // Stock restored

    // Check inventory movement records were created
    const movements = await db.select()
      .from(inventoryMovementsTable)
      .where(eq(inventoryMovementsTable.reference_id, testData.transaction.id))
      .execute();

    expect(movements.length).toEqual(2);
    expect(movements[0].movement_type).toEqual('in');
    expect(movements[0].reference_type).toEqual('transaction_cancellation');
  });

  it('should reduce inventory when changing from cancelled to completed', async () => {
    const testData = await createTestData();

    // First set transaction to cancelled
    await db.update(transactionsTable)
      .set({ status: 'cancelled' })
      .where(eq(transactionsTable.id, testData.transaction.id))
      .execute();

    const updateInput: UpdateTransactionInput = {
      id: testData.transaction.id,
      status: 'completed'
    };

    const result = await updateTransaction(updateInput);

    expect(result.status).toEqual('completed');

    // Check that inventory was reduced
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, testData.product1.id))
      .execute();

    expect(products[0].stock_quantity).toEqual(99); // Stock reduced by 1

    const products2 = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, testData.product2.id))
      .execute();

    expect(products2[0].stock_quantity).toEqual(49); // Stock reduced by 1

    // Check inventory movement records were created
    const movements = await db.select()
      .from(inventoryMovementsTable)
      .where(eq(inventoryMovementsTable.reference_id, testData.transaction.id))
      .execute();

    expect(movements.length).toEqual(2);
    expect(movements[0].movement_type).toEqual('out');
    expect(movements[0].reference_type).toEqual('transaction_completion');
  });

  it('should throw error when changing to completed with insufficient stock', async () => {
    const testData = await createTestData();

    // First set transaction to cancelled
    await db.update(transactionsTable)
      .set({ status: 'cancelled' })
      .where(eq(transactionsTable.id, testData.transaction.id))
      .execute();

    // Reduce product stock to insufficient levels
    await db.update(productsTable)
      .set({ stock_quantity: 0 })
      .where(eq(productsTable.id, testData.product1.id))
      .execute();

    const updateInput: UpdateTransactionInput = {
      id: testData.transaction.id,
      status: 'completed'
    };

    await expect(updateTransaction(updateInput)).rejects.toThrow(/insufficient stock/i);
  });

  it('should throw error for non-existent transaction', async () => {
    const updateInput: UpdateTransactionInput = {
      id: 99999,
      status: 'completed'
    };

    await expect(updateTransaction(updateInput)).rejects.toThrow(/not found/i);
  });

  it('should update transaction in database', async () => {
    const testData = await createTestData();

    const updateInput: UpdateTransactionInput = {
      id: testData.transaction.id,
      payment_method: 'debit_card',
      status: 'completed'
    };

    await updateTransaction(updateInput);

    // Verify the transaction was updated in the database
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, testData.transaction.id))
      .execute();

    expect(transactions).toHaveLength(1);
    expect(transactions[0].payment_method).toEqual('debit_card');
    expect(transactions[0].status).toEqual('completed');
    expect(transactions[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle multiple field updates correctly', async () => {
    const testData = await createTestData();

    const updateInput: UpdateTransactionInput = {
      id: testData.transaction.id,
      customer_id: null,
      total_amount: 150.00,
      discount_amount: 15.00,
      status: 'completed',
      payment_method: 'digital_wallet',
      notes: 'Bulk update test'
    };

    const result = await updateTransaction(updateInput);

    expect(result.customer_id).toBeNull();
    expect(result.total_amount).toEqual(150.00);
    expect(result.discount_amount).toEqual(15.00);
    expect(result.final_amount).toEqual(135.00);
    expect(result.status).toEqual('completed');
    expect(result.payment_method).toEqual('digital_wallet');
    expect(result.notes).toEqual('Bulk update test');
    expect(typeof result.total_amount).toBe('number');
    expect(typeof result.final_amount).toBe('number');
  });
});