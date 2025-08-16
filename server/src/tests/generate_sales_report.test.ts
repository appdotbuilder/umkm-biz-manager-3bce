import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, productsTable, customersTable, transactionsTable, transactionItemsTable } from '../db/schema';
import { type ReportPeriod } from '../schema';
import { generateSalesReport, getDailySalesReport, getMonthlySalesReport } from '../handlers/generate_sales_report';

describe('generateSalesReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const setupTestData = async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        role: 'employee'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create test customer
    const customerResult = await db.insert(customersTable)
      .values({
        name: 'Test Customer',
        email: 'customer@example.com'
      })
      .returning()
      .execute();
    const customerId = customerResult[0].id;

    // Create test products
    const productResults = await db.insert(productsTable)
      .values([
        {
          name: 'Product A',
          description: 'Test product A',
          price: '25.99',
          stock_quantity: 100
        },
        {
          name: 'Product B',
          description: 'Test product B',
          price: '15.50',
          stock_quantity: 50
        },
        {
          name: 'Product C',
          description: 'Test product C',
          price: '30.00',
          stock_quantity: 75
        }
      ])
      .returning()
      .execute();

    return { userId, customerId, products: productResults };
  };

  const createTestTransaction = async (
    userId: number,
    customerId: number,
    totalAmount: number,
    discountAmount: number,
    status: 'pending' | 'completed' | 'cancelled' = 'completed',
    createdAt?: Date
  ) => {
    const transaction = await db.insert(transactionsTable)
      .values({
        customer_id: customerId,
        user_id: userId,
        total_amount: totalAmount.toString(),
        discount_amount: discountAmount.toString(),
        final_amount: (totalAmount - discountAmount).toString(),
        status: status,
        payment_method: 'cash',
        created_at: createdAt
      })
      .returning()
      .execute();

    return transaction[0];
  };

  const createTestTransactionItems = async (transactionId: number, items: Array<{
    product_id: number;
    quantity: number;
    unit_price: number;
  }>) => {
    const itemsData = items.map(item => ({
      transaction_id: transactionId,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price.toString(),
      total_price: (item.quantity * item.unit_price).toString()
    }));

    return await db.insert(transactionItemsTable)
      .values(itemsData)
      .returning()
      .execute();
  };

  it('should generate sales report for a period', async () => {
    const { userId, customerId, products } = await setupTestData();

    // Create transactions in the period with explicit dates
    const transaction1 = await createTestTransaction(
      userId, customerId, 100.00, 5.00, 'completed', 
      new Date('2024-01-10T10:00:00')
    );
    await createTestTransactionItems(transaction1.id, [
      { product_id: products[0].id, quantity: 2, unit_price: 25.99 },
      { product_id: products[1].id, quantity: 3, unit_price: 15.50 }
    ]);

    const transaction2 = await createTestTransaction(
      userId, customerId, 60.00, 0.00, 'completed',
      new Date('2024-01-20T15:30:00')
    );
    await createTestTransactionItems(transaction2.id, [
      { product_id: products[0].id, quantity: 1, unit_price: 25.99 },
      { product_id: products[2].id, quantity: 1, unit_price: 30.00 }
    ]);

    const period: ReportPeriod = {
      start_date: '2024-01-01',
      end_date: '2024-01-31'
    };

    const report = await generateSalesReport(period);

    expect(report.period).toEqual('2024-01-01 to 2024-01-31');
    expect(report.total_transactions).toEqual(2);
    expect(report.total_revenue).toEqual(155.00); // (100-5) + (60-0)
    expect(report.total_discount).toEqual(5.00);
    expect(report.top_products).toHaveLength(3);

    // Check top product (Product A with 3 total quantity)
    const topProduct = report.top_products[0];
    expect(topProduct.product_name).toEqual('Product A');
    expect(topProduct.quantity_sold).toEqual(3);
    expect(topProduct.revenue).toEqual(77.97); // (2 * 25.99) + (1 * 25.99)
  });

  it('should only include completed transactions', async () => {
    const { userId, customerId, products } = await setupTestData();

    // Create completed transaction with explicit date in period
    const completedTransaction = await createTestTransaction(
      userId, customerId, 50.00, 0.00, 'completed',
      new Date('2024-01-15T10:00:00')
    );
    await createTestTransactionItems(completedTransaction.id, [
      { product_id: products[0].id, quantity: 1, unit_price: 25.99 }
    ]);

    // Create pending transaction with explicit date in period
    const pendingTransaction = await createTestTransaction(
      userId, customerId, 30.00, 0.00, 'pending',
      new Date('2024-01-16T10:00:00')
    );
    await createTestTransactionItems(pendingTransaction.id, [
      { product_id: products[1].id, quantity: 1, unit_price: 15.50 }
    ]);

    // Create cancelled transaction with explicit date in period
    const cancelledTransaction = await createTestTransaction(
      userId, customerId, 40.00, 0.00, 'cancelled',
      new Date('2024-01-17T10:00:00')
    );
    await createTestTransactionItems(cancelledTransaction.id, [
      { product_id: products[2].id, quantity: 1, unit_price: 30.00 }
    ]);

    const period: ReportPeriod = {
      start_date: '2024-01-01',
      end_date: '2024-01-31'
    };

    const report = await generateSalesReport(period);

    expect(report.total_transactions).toEqual(1);
    expect(report.total_revenue).toEqual(50.00);
    expect(report.top_products).toHaveLength(1);
    expect(report.top_products[0].product_name).toEqual('Product A');
  });

  it('should handle empty period with no transactions', async () => {
    await setupTestData();

    const period: ReportPeriod = {
      start_date: '2025-01-01',
      end_date: '2025-01-31'
    };

    const report = await generateSalesReport(period);

    expect(report.period).toEqual('2025-01-01 to 2025-01-31');
    expect(report.total_transactions).toEqual(0);
    expect(report.total_revenue).toEqual(0);
    expect(report.total_discount).toEqual(0);
    expect(report.top_products).toHaveLength(0);
  });

  it('should filter transactions by date range correctly', async () => {
    const { userId, customerId, products } = await setupTestData();

    // Transaction outside period (before)
    await createTestTransaction(
      userId, customerId, 25.00, 0.00, 'completed',
      new Date('2023-12-31')
    );

    // Transaction inside period
    const insideTransaction = await createTestTransaction(
      userId, customerId, 50.00, 5.00, 'completed',
      new Date('2024-01-15')
    );
    await createTestTransactionItems(insideTransaction.id, [
      { product_id: products[0].id, quantity: 1, unit_price: 25.99 }
    ]);

    // Transaction outside period (after)
    await createTestTransaction(
      userId, customerId, 35.00, 0.00, 'completed',
      new Date('2024-02-01')
    );

    const period: ReportPeriod = {
      start_date: '2024-01-01',
      end_date: '2024-01-31'
    };

    const report = await generateSalesReport(period);

    expect(report.total_transactions).toEqual(1);
    expect(report.total_revenue).toEqual(45.00); // 50 - 5
    expect(report.total_discount).toEqual(5.00);
  });

  it('should sort top products by quantity sold descending', async () => {
    const { userId, customerId, products } = await setupTestData();

    const transaction = await createTestTransaction(
      userId, customerId, 200.00, 0.00, 'completed',
      new Date('2024-01-15T10:00:00')
    );
    await createTestTransactionItems(transaction.id, [
      { product_id: products[0].id, quantity: 5, unit_price: 25.99 }, // Most sold
      { product_id: products[1].id, quantity: 3, unit_price: 15.50 }, // Second
      { product_id: products[2].id, quantity: 1, unit_price: 30.00 }  // Least sold
    ]);

    const period: ReportPeriod = {
      start_date: '2024-01-01',
      end_date: '2024-01-31'
    };

    const report = await generateSalesReport(period);

    expect(report.top_products).toHaveLength(3);
    expect(report.top_products[0].product_name).toEqual('Product A');
    expect(report.top_products[0].quantity_sold).toEqual(5);
    expect(report.top_products[1].product_name).toEqual('Product B');
    expect(report.top_products[1].quantity_sold).toEqual(3);
    expect(report.top_products[2].product_name).toEqual('Product C');
    expect(report.top_products[2].quantity_sold).toEqual(1);
  });
});

describe('getDailySalesReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate daily sales report', async () => {
    // Setup test data
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        role: 'employee'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    const customerResult = await db.insert(customersTable)
      .values({
        name: 'Test Customer',
        email: 'customer@example.com'
      })
      .returning()
      .execute();
    const customerId = customerResult[0].id;

    const productResult = await db.insert(productsTable)
      .values({
        name: 'Test Product',
        price: '25.99',
        stock_quantity: 100
      })
      .returning()
      .execute();
    const productId = productResult[0].id;

    // Create transaction for specific date
    const transaction = await db.insert(transactionsTable)
      .values({
        customer_id: customerId,
        user_id: userId,
        total_amount: '50.00',
        discount_amount: '5.00',
        final_amount: '45.00',
        status: 'completed',
        created_at: new Date('2024-01-15T14:30:00')
      })
      .returning()
      .execute();

    await db.insert(transactionItemsTable)
      .values({
        transaction_id: transaction[0].id,
        product_id: productId,
        quantity: 2,
        unit_price: '25.00',
        total_price: '50.00'
      })
      .execute();

    const report = await getDailySalesReport('2024-01-15');

    expect(report.period).toEqual('Daily - 2024-01-15');
    expect(report.total_transactions).toEqual(1);
    expect(report.total_revenue).toEqual(45.00);
    expect(report.total_discount).toEqual(5.00);
    expect(report.top_products).toHaveLength(1);
    expect(report.top_products[0].product_name).toEqual('Test Product');
  });

  it('should return empty report for date with no transactions', async () => {
    const report = await getDailySalesReport('2024-01-01');

    expect(report.period).toEqual('Daily - 2024-01-01');
    expect(report.total_transactions).toEqual(0);
    expect(report.total_revenue).toEqual(0);
    expect(report.total_discount).toEqual(0);
    expect(report.top_products).toHaveLength(0);
  });
});

describe('getMonthlySalesReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate monthly sales report', async () => {
    // Setup test data
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        role: 'employee'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    const customerResult = await db.insert(customersTable)
      .values({
        name: 'Test Customer',
        email: 'customer@example.com'
      })
      .returning()
      .execute();
    const customerId = customerResult[0].id;

    const productResult = await db.insert(productsTable)
      .values({
        name: 'Monthly Product',
        price: '40.00',
        stock_quantity: 100
      })
      .returning()
      .execute();
    const productId = productResult[0].id;

    // Create transactions in January 2024
    const transaction1 = await db.insert(transactionsTable)
      .values({
        customer_id: customerId,
        user_id: userId,
        total_amount: '80.00',
        discount_amount: '10.00',
        final_amount: '70.00',
        status: 'completed',
        created_at: new Date('2024-01-05T10:00:00')
      })
      .returning()
      .execute();

    const transaction2 = await db.insert(transactionsTable)
      .values({
        customer_id: customerId,
        user_id: userId,
        total_amount: '40.00',
        discount_amount: '0.00',
        final_amount: '40.00',
        status: 'completed',
        created_at: new Date('2024-01-25T15:30:00')
      })
      .returning()
      .execute();

    await db.insert(transactionItemsTable)
      .values([
        {
          transaction_id: transaction1[0].id,
          product_id: productId,
          quantity: 2,
          unit_price: '40.00',
          total_price: '80.00'
        },
        {
          transaction_id: transaction2[0].id,
          product_id: productId,
          quantity: 1,
          unit_price: '40.00',
          total_price: '40.00'
        }
      ])
      .execute();

    const report = await getMonthlySalesReport(2024, 1);

    expect(report.period).toEqual('Monthly - 2024/01');
    expect(report.total_transactions).toEqual(2);
    expect(report.total_revenue).toEqual(110.00); // 70 + 40
    expect(report.total_discount).toEqual(10.00);
    expect(report.top_products).toHaveLength(1);
    expect(report.top_products[0].product_name).toEqual('Monthly Product');
    expect(report.top_products[0].quantity_sold).toEqual(3);
  });

  it('should handle different months correctly', async () => {
    const report = await getMonthlySalesReport(2024, 2);

    expect(report.period).toEqual('Monthly - 2024/02');
    expect(report.total_transactions).toEqual(0);
    expect(report.total_revenue).toEqual(0);
  });

  it('should pad single digit months correctly', async () => {
    const report = await getMonthlySalesReport(2024, 9);
    expect(report.period).toEqual('Monthly - 2024/09');
  });
});