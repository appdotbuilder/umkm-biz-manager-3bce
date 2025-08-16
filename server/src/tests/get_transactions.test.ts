import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  customersTable, 
  productsTable, 
  transactionsTable, 
  transactionItemsTable 
} from '../db/schema';
import { 
  getTransactions, 
  getTransactionById, 
  getTransactionsByDateRange,
  type GetTransactionsFilters 
} from '../handlers/get_transactions';

describe('getTransactions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUser: { id: number };
  let testCustomer: { id: number };
  let testProduct: { id: number };

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable).values({
      username: 'testuser',
      email: 'test@example.com',
      password_hash: 'hashedpassword',
      role: 'employee'
    }).returning().execute();
    testUser = userResult[0];

    // Create test customer
    const customerResult = await db.insert(customersTable).values({
      name: 'Test Customer',
      email: 'customer@example.com',
      phone: '123-456-7890',
      address: '123 Test St'
    }).returning().execute();
    testCustomer = customerResult[0];

    // Create test product
    const productResult = await db.insert(productsTable).values({
      name: 'Test Product',
      description: 'A test product',
      price: '29.99',
      stock_quantity: 100,
      min_stock_level: 10,
      category: 'Electronics',
      sku: 'TEST-001'
    }).returning().execute();
    testProduct = productResult[0];
  });

  it('should return all transactions when no filters applied', async () => {
    // Create test transactions
    const transaction1 = await db.insert(transactionsTable).values({
      customer_id: testCustomer.id,
      user_id: testUser.id,
      total_amount: '100.00',
      discount_amount: '10.00',
      final_amount: '90.00',
      status: 'completed',
      payment_method: 'cash'
    }).returning().execute();

    const transaction2 = await db.insert(transactionsTable).values({
      customer_id: null,
      user_id: testUser.id,
      total_amount: '50.00',
      discount_amount: '0.00',
      final_amount: '50.00',
      status: 'pending',
      payment_method: 'card'
    }).returning().execute();

    const results = await getTransactions();

    expect(results).toHaveLength(2);
    expect(results[0].total_amount).toEqual(50.00); // Most recent first
    expect(results[1].total_amount).toEqual(100.00);
    expect(typeof results[0].total_amount).toEqual('number');
    expect(typeof results[0].discount_amount).toEqual('number');
    expect(typeof results[0].final_amount).toEqual('number');
  });

  it('should filter transactions by customer_id', async () => {
    // Create another customer
    const customer2 = await db.insert(customersTable).values({
      name: 'Customer 2',
      email: 'customer2@example.com'
    }).returning().execute();

    await db.insert(transactionsTable).values({
      customer_id: testCustomer.id,
      user_id: testUser.id,
      total_amount: '100.00',
      discount_amount: '0.00',
      final_amount: '100.00',
      status: 'completed'
    }).execute();

    await db.insert(transactionsTable).values({
      customer_id: customer2[0].id,
      user_id: testUser.id,
      total_amount: '200.00',
      discount_amount: '0.00',
      final_amount: '200.00',
      status: 'completed'
    }).execute();

    const filters: GetTransactionsFilters = { customer_id: testCustomer.id };
    const results = await getTransactions(filters);

    expect(results).toHaveLength(1);
    expect(results[0].customer_id).toEqual(testCustomer.id);
    expect(results[0].final_amount).toEqual(100.00);
  });

  it('should filter transactions by status', async () => {
    await db.insert(transactionsTable).values({
      customer_id: testCustomer.id,
      user_id: testUser.id,
      total_amount: '100.00',
      discount_amount: '0.00',
      final_amount: '100.00',
      status: 'completed'
    }).execute();

    await db.insert(transactionsTable).values({
      customer_id: testCustomer.id,
      user_id: testUser.id,
      total_amount: '150.00',
      discount_amount: '0.00',
      final_amount: '150.00',
      status: 'pending'
    }).execute();

    const filters: GetTransactionsFilters = { status: 'completed' };
    const results = await getTransactions(filters);

    expect(results).toHaveLength(1);
    expect(results[0].status).toEqual('completed');
    expect(results[0].final_amount).toEqual(100.00);
  });

  it('should filter transactions by date range', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await db.insert(transactionsTable).values({
      customer_id: testCustomer.id,
      user_id: testUser.id,
      total_amount: '100.00',
      discount_amount: '0.00',
      final_amount: '100.00',
      status: 'completed'
    }).execute();

    const filters: GetTransactionsFilters = {
      start_date: yesterday.toISOString(),
      end_date: tomorrow.toISOString()
    };
    const results = await getTransactions(filters);

    expect(results).toHaveLength(1);
    expect(results[0].created_at).toBeInstanceOf(Date);
    expect(results[0].created_at >= yesterday).toBe(true);
    expect(results[0].created_at <= tomorrow).toBe(true);
  });

  it('should apply pagination correctly', async () => {
    // Create multiple transactions
    for (let i = 0; i < 5; i++) {
      await db.insert(transactionsTable).values({
        customer_id: testCustomer.id,
        user_id: testUser.id,
        total_amount: `${(i + 1) * 10}.00`,
        discount_amount: '0.00',
        final_amount: `${(i + 1) * 10}.00`,
        status: 'completed'
      }).execute();
    }

    const filters: GetTransactionsFilters = { limit: 2, offset: 1 };
    const results = await getTransactions(filters);

    expect(results).toHaveLength(2);
    // Should skip the first (most recent) transaction
    expect(results[0].final_amount).toEqual(40.00);
    expect(results[1].final_amount).toEqual(30.00);
  });

  it('should combine multiple filters correctly', async () => {
    // Create user 2
    const user2 = await db.insert(usersTable).values({
      username: 'testuser2',
      email: 'test2@example.com',
      password_hash: 'hashedpassword',
      role: 'admin'
    }).returning().execute();

    await db.insert(transactionsTable).values({
      customer_id: testCustomer.id,
      user_id: testUser.id,
      total_amount: '100.00',
      discount_amount: '0.00',
      final_amount: '100.00',
      status: 'completed'
    }).execute();

    await db.insert(transactionsTable).values({
      customer_id: testCustomer.id,
      user_id: user2[0].id,
      total_amount: '200.00',
      discount_amount: '0.00',
      final_amount: '200.00',
      status: 'pending'
    }).execute();

    const filters: GetTransactionsFilters = {
      customer_id: testCustomer.id,
      status: 'completed'
    };
    const results = await getTransactions(filters);

    expect(results).toHaveLength(1);
    expect(results[0].customer_id).toEqual(testCustomer.id);
    expect(results[0].status).toEqual('completed');
    expect(results[0].user_id).toEqual(testUser.id);
  });
});

describe('getTransactionById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUser: { id: number };
  let testCustomer: { id: number };
  let testProduct: { id: number };
  let testTransaction: { id: number };

  beforeEach(async () => {
    // Create prerequisites
    const userResult = await db.insert(usersTable).values({
      username: 'testuser',
      email: 'test@example.com',
      password_hash: 'hashedpassword',
      role: 'employee'
    }).returning().execute();
    testUser = userResult[0];

    const customerResult = await db.insert(customersTable).values({
      name: 'Test Customer',
      email: 'customer@example.com',
      phone: '123-456-7890',
      address: '123 Test St'
    }).returning().execute();
    testCustomer = customerResult[0];

    const productResult = await db.insert(productsTable).values({
      name: 'Test Product',
      description: 'A test product',
      price: '29.99',
      stock_quantity: 100,
      min_stock_level: 10,
      category: 'Electronics',
      sku: 'TEST-001'
    }).returning().execute();
    testProduct = productResult[0];

    const transactionResult = await db.insert(transactionsTable).values({
      customer_id: testCustomer.id,
      user_id: testUser.id,
      total_amount: '89.97',
      discount_amount: '10.00',
      final_amount: '79.97',
      status: 'completed',
      payment_method: 'card',
      notes: 'Test transaction'
    }).returning().execute();
    testTransaction = transactionResult[0];

    // Create transaction items
    await db.insert(transactionItemsTable).values({
      transaction_id: testTransaction.id,
      product_id: testProduct.id,
      quantity: 3,
      unit_price: '29.99',
      total_price: '89.97'
    }).execute();
  });

  it('should return transaction with all details', async () => {
    const result = await getTransactionById(testTransaction.id);

    expect(result).toBeDefined();
    expect(result!.id).toEqual(testTransaction.id);
    expect(result!.total_amount).toEqual(89.97);
    expect(result!.discount_amount).toEqual(10.00);
    expect(result!.final_amount).toEqual(79.97);
    expect(result!.status).toEqual('completed');
    expect(result!.payment_method).toEqual('card');
    expect(result!.notes).toEqual('Test transaction');
    expect(typeof result!.total_amount).toEqual('number');

    // Check customer details
    expect(result!.customer).toBeDefined();
    expect(result!.customer!.name).toEqual('Test Customer');
    expect(result!.customer!.email).toEqual('customer@example.com');

    // Check user details
    expect(result!.user).toBeDefined();
    expect(result!.user.username).toEqual('testuser');
    expect(result!.user.role).toEqual('employee');

    // Check items
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].quantity).toEqual(3);
    expect(result!.items[0].unit_price).toEqual(29.99);
    expect(result!.items[0].total_price).toEqual(89.97);
    expect(typeof result!.items[0].unit_price).toEqual('number');

    // Check product details within item
    expect(result!.items[0].product.name).toEqual('Test Product');
    expect(result!.items[0].product.price).toEqual(29.99);
    expect(result!.items[0].product.sku).toEqual('TEST-001');
    expect(typeof result!.items[0].product.price).toEqual('number');
  });

  it('should return null for non-existent transaction', async () => {
    const result = await getTransactionById(99999);
    expect(result).toBeNull();
  });

  it('should handle transaction without customer', async () => {
    const transactionResult = await db.insert(transactionsTable).values({
      customer_id: null,
      user_id: testUser.id,
      total_amount: '50.00',
      discount_amount: '0.00',
      final_amount: '50.00',
      status: 'pending'
    }).returning().execute();

    const result = await getTransactionById(transactionResult[0].id);

    expect(result).toBeDefined();
    expect(result!.customer).toBeNull();
    expect(result!.user).toBeDefined();
    expect(result!.final_amount).toEqual(50.00);
  });
});

describe('getTransactionsByDateRange', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUser: { id: number };
  let testCustomer: { id: number };

  beforeEach(async () => {
    const userResult = await db.insert(usersTable).values({
      username: 'testuser',
      email: 'test@example.com',
      password_hash: 'hashedpassword',
      role: 'employee'
    }).returning().execute();
    testUser = userResult[0];

    const customerResult = await db.insert(customersTable).values({
      name: 'Test Customer',
      email: 'customer@example.com'
    }).returning().execute();
    testCustomer = customerResult[0];
  });

  it('should return transactions within date range', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Create transaction within range
    await db.insert(transactionsTable).values({
      customer_id: testCustomer.id,
      user_id: testUser.id,
      total_amount: '100.00',
      discount_amount: '0.00',
      final_amount: '100.00',
      status: 'completed'
    }).execute();

    const results = await getTransactionsByDateRange(
      yesterday.toISOString(),
      tomorrow.toISOString()
    );

    expect(results).toHaveLength(1);
    expect(results[0].final_amount).toEqual(100.00);
    expect(typeof results[0].final_amount).toEqual('number');
    expect(results[0].created_at).toBeInstanceOf(Date);
  });

  it('should return empty array when no transactions in range', async () => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const results = await getTransactionsByDateRange(
      lastWeek.toISOString(),
      fiveDaysAgo.toISOString()
    );

    expect(results).toHaveLength(0);
  });

  it('should return transactions ordered by most recent first', async () => {
    // Create multiple transactions with slight delays
    await db.insert(transactionsTable).values({
      customer_id: testCustomer.id,
      user_id: testUser.id,
      total_amount: '100.00',
      discount_amount: '0.00',
      final_amount: '100.00',
      status: 'completed'
    }).execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(transactionsTable).values({
      customer_id: testCustomer.id,
      user_id: testUser.id,
      total_amount: '200.00',
      discount_amount: '0.00',
      final_amount: '200.00',
      status: 'pending'
    }).execute();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const results = await getTransactionsByDateRange(
      yesterday.toISOString(),
      tomorrow.toISOString()
    );

    expect(results).toHaveLength(2);
    // Most recent should be first
    expect(results[0].final_amount).toEqual(200.00);
    expect(results[1].final_amount).toEqual(100.00);
    expect(results[0].created_at >= results[1].created_at).toBe(true);
  });
});