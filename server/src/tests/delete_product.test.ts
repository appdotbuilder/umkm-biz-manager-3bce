import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  productsTable, 
  usersTable, 
  customersTable, 
  transactionsTable, 
  transactionItemsTable 
} from '../db/schema';
import { deleteProduct } from '../handlers/delete_product';
import { eq } from 'drizzle-orm';

describe('deleteProduct', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should soft delete a product by setting is_active to false', async () => {
    // Create a test product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Test Product',
        description: 'A test product',
        price: '29.99',
        stock_quantity: 100,
        min_stock_level: 10,
        category: 'Electronics',
        sku: 'TEST-001'
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    // Verify product is initially active
    expect(productResult[0].is_active).toBe(true);

    // Delete the product
    const result = await deleteProduct(productId);

    // Verify deletion was successful
    expect(result.success).toBe(true);

    // Verify product is soft deleted (still exists but inactive)
    const updatedProducts = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(updatedProducts).toHaveLength(1);
    expect(updatedProducts[0].is_active).toBe(false);
    expect(updatedProducts[0].name).toEqual('Test Product');
  });

  it('should soft delete product with transaction history', async () => {
    // Create prerequisite data: user, customer, product
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        role: 'employee'
      })
      .returning()
      .execute();

    const customerResult = await db.insert(customersTable)
      .values({
        name: 'Test Customer',
        email: 'customer@example.com',
        phone: '123-456-7890'
      })
      .returning()
      .execute();

    const productResult = await db.insert(productsTable)
      .values({
        name: 'Product with History',
        description: 'Product that has been sold',
        price: '49.99',
        stock_quantity: 50,
        min_stock_level: 5,
        category: 'Books',
        sku: 'BOOK-001'
      })
      .returning()
      .execute();

    const productId = productResult[0].id;
    const userId = userResult[0].id;
    const customerId = customerResult[0].id;

    // Create a transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        customer_id: customerId,
        user_id: userId,
        total_amount: '99.98',
        discount_amount: '0.00',
        final_amount: '99.98',
        status: 'completed',
        payment_method: 'cash'
      })
      .returning()
      .execute();

    const transactionId = transactionResult[0].id;

    // Create transaction item linking to our product
    await db.insert(transactionItemsTable)
      .values({
        transaction_id: transactionId,
        product_id: productId,
        quantity: 2,
        unit_price: '49.99',
        total_price: '99.98'
      })
      .execute();

    // Delete the product
    const result = await deleteProduct(productId);

    // Verify deletion was successful
    expect(result.success).toBe(true);

    // Verify product is soft deleted but still exists
    const updatedProducts = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(updatedProducts).toHaveLength(1);
    expect(updatedProducts[0].is_active).toBe(false);
    expect(updatedProducts[0].name).toEqual('Product with History');

    // Verify transaction history is preserved
    const transactionItems = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.product_id, productId))
      .execute();

    expect(transactionItems).toHaveLength(1);
    expect(transactionItems[0].quantity).toEqual(2);
    expect(parseFloat(transactionItems[0].unit_price)).toEqual(49.99);
  });

  it('should return success when deleting already inactive product', async () => {
    // Create an inactive product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Already Inactive Product',
        description: 'This product is already inactive',
        price: '15.00',
        stock_quantity: 0,
        min_stock_level: 0,
        category: 'Test',
        sku: 'INACTIVE-001',
        is_active: false
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    // Verify product is initially inactive
    expect(productResult[0].is_active).toBe(false);

    // Attempt to delete the already inactive product
    const result = await deleteProduct(productId);

    // Should return success without error
    expect(result.success).toBe(true);

    // Verify product remains inactive
    const updatedProducts = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(updatedProducts).toHaveLength(1);
    expect(updatedProducts[0].is_active).toBe(false);
  });

  it('should throw error when product does not exist', async () => {
    const nonExistentId = 99999;

    // Attempt to delete non-existent product
    await expect(deleteProduct(nonExistentId)).rejects.toThrow(/Product with id 99999 not found/i);
  });

  it('should update the updated_at timestamp when soft deleting', async () => {
    // Create a test product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Timestamp Test Product',
        description: 'Testing timestamp updates',
        price: '25.50',
        stock_quantity: 20,
        min_stock_level: 2,
        category: 'Test',
        sku: 'TIMESTAMP-001'
      })
      .returning()
      .execute();

    const productId = productResult[0].id;
    const originalUpdatedAt = productResult[0].updated_at;

    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    // Delete the product
    const result = await deleteProduct(productId);

    expect(result.success).toBe(true);

    // Verify updated_at timestamp was updated
    const updatedProducts = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(updatedProducts).toHaveLength(1);
    expect(updatedProducts[0].is_active).toBe(false);
    expect(updatedProducts[0].updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should handle products without transaction history correctly', async () => {
    // Create a product that has never been sold
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Never Sold Product',
        description: 'This product has no transaction history',
        price: '75.00',
        stock_quantity: 100,
        min_stock_level: 10,
        category: 'New',
        sku: 'NEVER-SOLD-001'
      })
      .returning()
      .execute();

    const productId = productResult[0].id;

    // Verify no transaction history exists
    const transactionItems = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.product_id, productId))
      .execute();

    expect(transactionItems).toHaveLength(0);

    // Delete the product
    const result = await deleteProduct(productId);

    // Verify deletion was successful
    expect(result.success).toBe(true);

    // Verify product is soft deleted
    const updatedProducts = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(updatedProducts).toHaveLength(1);
    expect(updatedProducts[0].is_active).toBe(false);
    expect(updatedProducts[0].name).toEqual('Never Sold Product');
  });
});