import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, customersTable, productsTable, transactionsTable, transactionItemsTable, inventoryMovementsTable } from '../db/schema';
import { type CreateTransactionInput } from '../schema';
import { createTransaction } from '../handlers/create_transaction';
import { eq } from 'drizzle-orm';

describe('createTransaction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create prerequisite data
  const setupTestData = async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        role: 'employee'
      })
      .returning()
      .execute();

    // Create customer
    const customerResult = await db.insert(customersTable)
      .values({
        name: 'Test Customer',
        email: 'customer@example.com',
        phone: '123-456-7890'
      })
      .returning()
      .execute();

    // Create products
    const product1Result = await db.insert(productsTable)
      .values({
        name: 'Product 1',
        description: 'Test product 1',
        price: '19.99',
        stock_quantity: 100,
        min_stock_level: 10
      })
      .returning()
      .execute();

    const product2Result = await db.insert(productsTable)
      .values({
        name: 'Product 2',
        description: 'Test product 2',
        price: '29.99',
        stock_quantity: 50,
        min_stock_level: 5
      })
      .returning()
      .execute();

    return {
      user: userResult[0],
      customer: customerResult[0],
      product1: product1Result[0],
      product2: product2Result[0]
    };
  };

  it('should create a transaction with items', async () => {
    const { user, customer, product1, product2 } = await setupTestData();

    const testInput: CreateTransactionInput = {
      customer_id: customer.id,
      user_id: user.id,
      total_amount: 99.97,
      discount_amount: 5.00,
      payment_method: 'cash',
      notes: 'Test transaction',
      items: [
        {
          product_id: product1.id,
          quantity: 2,
          unit_price: 19.99
        },
        {
          product_id: product2.id,
          quantity: 2,
          unit_price: 29.99
        }
      ]
    };

    const result = await createTransaction(testInput);

    // Verify transaction fields
    expect(result.customer_id).toEqual(customer.id);
    expect(result.user_id).toEqual(user.id);
    expect(result.total_amount).toEqual(99.97);
    expect(result.discount_amount).toEqual(5.00);
    expect(result.final_amount).toEqual(94.97);
    expect(result.status).toEqual('completed');
    expect(result.payment_method).toEqual('cash');
    expect(result.notes).toEqual('Test transaction');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify numeric types
    expect(typeof result.total_amount).toBe('number');
    expect(typeof result.discount_amount).toBe('number');
    expect(typeof result.final_amount).toBe('number');
  });

  it('should create transaction items in database', async () => {
    const { user, customer, product1, product2 } = await setupTestData();

    const testInput: CreateTransactionInput = {
      customer_id: customer.id,
      user_id: user.id,
      total_amount: 99.97,
      discount_amount: 0,
      payment_method: 'credit_card',
      notes: null,
      items: [
        {
          product_id: product1.id,
          quantity: 2,
          unit_price: 19.99
        },
        {
          product_id: product2.id,
          quantity: 1,
          unit_price: 29.99
        }
      ]
    };

    const result = await createTransaction(testInput);

    // Verify transaction items were created
    const transactionItems = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.transaction_id, result.id))
      .execute();

    expect(transactionItems).toHaveLength(2);
    
    // Check first item
    const item1 = transactionItems.find(item => item.product_id === product1.id);
    expect(item1).toBeDefined();
    expect(item1!.quantity).toEqual(2);
    expect(parseFloat(item1!.unit_price)).toEqual(19.99);
    expect(parseFloat(item1!.total_price)).toEqual(39.98);

    // Check second item
    const item2 = transactionItems.find(item => item.product_id === product2.id);
    expect(item2).toBeDefined();
    expect(item2!.quantity).toEqual(1);
    expect(parseFloat(item2!.unit_price)).toEqual(29.99);
    expect(parseFloat(item2!.total_price)).toEqual(29.99);
  });

  it('should update product stock quantities', async () => {
    const { user, customer, product1, product2 } = await setupTestData();

    const testInput: CreateTransactionInput = {
      customer_id: customer.id,
      user_id: user.id,
      total_amount: 79.96,
      discount_amount: 0,
      payment_method: 'cash',
      notes: null,
      items: [
        {
          product_id: product1.id,
          quantity: 3,
          unit_price: 19.99
        },
        {
          product_id: product2.id,
          quantity: 1,
          unit_price: 19.99
        }
      ]
    };

    await createTransaction(testInput);

    // Verify stock quantities were updated
    const updatedProducts = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, product1.id))
      .execute();

    expect(updatedProducts[0].stock_quantity).toEqual(97); // 100 - 3

    const updatedProduct2 = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, product2.id))
      .execute();

    expect(updatedProduct2[0].stock_quantity).toEqual(49); // 50 - 1
  });

  it('should create inventory movement records', async () => {
    const { user, customer, product1 } = await setupTestData();

    const testInput: CreateTransactionInput = {
      customer_id: customer.id,
      user_id: user.id,
      total_amount: 39.98,
      discount_amount: 0,
      payment_method: 'cash',
      notes: null,
      items: [
        {
          product_id: product1.id,
          quantity: 2,
          unit_price: 19.99
        }
      ]
    };

    const result = await createTransaction(testInput);

    // Verify inventory movement was created
    const movements = await db.select()
      .from(inventoryMovementsTable)
      .where(eq(inventoryMovementsTable.product_id, product1.id))
      .execute();

    expect(movements).toHaveLength(1);
    expect(movements[0].movement_type).toEqual('out');
    expect(movements[0].quantity).toEqual(-2); // Negative for outbound
    expect(movements[0].reference_type).toEqual('transaction');
    expect(movements[0].reference_id).toEqual(result.id);
    expect(movements[0].notes).toContain(`transaction #${result.id}`);
  });

  it('should work with null customer_id', async () => {
    const { user, product1 } = await setupTestData();

    const testInput: CreateTransactionInput = {
      customer_id: null,
      user_id: user.id,
      total_amount: 19.99,
      discount_amount: 0,
      payment_method: 'cash',
      notes: 'Walk-in customer',
      items: [
        {
          product_id: product1.id,
          quantity: 1,
          unit_price: 19.99
        }
      ]
    };

    const result = await createTransaction(testInput);

    expect(result.customer_id).toBeNull();
    expect(result.user_id).toEqual(user.id);
    expect(result.total_amount).toEqual(19.99);
    expect(result.final_amount).toEqual(19.99);
  });

  it('should calculate final amount correctly with discount', async () => {
    const { user, customer, product1 } = await setupTestData();

    const testInput: CreateTransactionInput = {
      customer_id: customer.id,
      user_id: user.id,
      total_amount: 100.00,
      discount_amount: 15.50,
      payment_method: 'cash',
      notes: null,
      items: [
        {
          product_id: product1.id,
          quantity: 5,
          unit_price: 20.00
        }
      ]
    };

    const result = await createTransaction(testInput);

    expect(result.total_amount).toEqual(100.00);
    expect(result.discount_amount).toEqual(15.50);
    expect(result.final_amount).toEqual(84.50);
  });

  it('should throw error for non-existent product', async () => {
    const { user, customer } = await setupTestData();

    const testInput: CreateTransactionInput = {
      customer_id: customer.id,
      user_id: user.id,
      total_amount: 19.99,
      discount_amount: 0,
      payment_method: 'cash',
      notes: null,
      items: [
        {
          product_id: 999, // Non-existent product
          quantity: 1,
          unit_price: 19.99
        }
      ]
    };

    await expect(createTransaction(testInput)).rejects.toThrow(/Product with ID 999 not found/i);
  });

  it('should throw error for insufficient stock', async () => {
    const { user, customer, product1 } = await setupTestData();

    const testInput: CreateTransactionInput = {
      customer_id: customer.id,
      user_id: user.id,
      total_amount: 1999.00,
      discount_amount: 0,
      payment_method: 'cash',
      notes: null,
      items: [
        {
          product_id: product1.id,
          quantity: 200, // More than available stock (100)
          unit_price: 19.99
        }
      ]
    };

    await expect(createTransaction(testInput)).rejects.toThrow(/Insufficient stock for product Product 1/i);
  });

  it('should handle multiple products with mixed stock scenarios', async () => {
    const { user, customer, product1, product2 } = await setupTestData();

    // First transaction to reduce stock
    const firstInput: CreateTransactionInput = {
      customer_id: customer.id,
      user_id: user.id,
      total_amount: 99.95,
      discount_amount: 0,
      payment_method: 'cash',
      notes: 'First transaction',
      items: [
        {
          product_id: product1.id,
          quantity: 50,
          unit_price: 19.99
        }
      ]
    };

    await createTransaction(firstInput);

    // Second transaction should still work with remaining stock
    const secondInput: CreateTransactionInput = {
      customer_id: customer.id,
      user_id: user.id,
      total_amount: 79.96,
      discount_amount: 10.00,
      payment_method: 'credit_card',
      notes: 'Second transaction',
      items: [
        {
          product_id: product1.id,
          quantity: 2, // Should work (remaining: 50)
          unit_price: 19.99
        },
        {
          product_id: product2.id,
          quantity: 1, // Should work (stock: 50)
          unit_price: 29.99
        }
      ]
    };

    const result = await createTransaction(secondInput);

    expect(result.total_amount).toEqual(79.96);
    expect(result.discount_amount).toEqual(10.00);
    expect(result.final_amount).toEqual(69.96);

    // Verify final stock quantities
    const finalProduct1 = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, product1.id))
      .execute();

    const finalProduct2 = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, product2.id))
      .execute();

    expect(finalProduct1[0].stock_quantity).toEqual(48); // 100 - 50 - 2
    expect(finalProduct2[0].stock_quantity).toEqual(49); // 50 - 1
  });
});