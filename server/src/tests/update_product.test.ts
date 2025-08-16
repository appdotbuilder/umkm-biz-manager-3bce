import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable } from '../db/schema';
import { type UpdateProductInput, type CreateProductInput } from '../schema';
import { updateProduct } from '../handlers/update_product';
import { eq } from 'drizzle-orm';

// Helper to create a test product
const createTestProduct = async (): Promise<number> => {
  const testProduct: CreateProductInput = {
    name: 'Original Product',
    description: 'Original description',
    price: 29.99,
    stock_quantity: 50,
    min_stock_level: 5,
    category: 'Electronics',
    sku: 'ORIG-001'
  };

  const result = await db.insert(productsTable)
    .values({
      name: testProduct.name,
      description: testProduct.description,
      price: testProduct.price.toString(),
      stock_quantity: testProduct.stock_quantity,
      min_stock_level: testProduct.min_stock_level,
      category: testProduct.category,
      sku: testProduct.sku
    })
    .returning()
    .execute();

  return result[0].id;
};

describe('updateProduct', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update product name', async () => {
    const productId = await createTestProduct();
    
    const updateInput: UpdateProductInput = {
      id: productId,
      name: 'Updated Product Name'
    };

    const result = await updateProduct(updateInput);

    expect(result.id).toEqual(productId);
    expect(result.name).toEqual('Updated Product Name');
    expect(result.description).toEqual('Original description'); // Unchanged
    expect(result.price).toEqual(29.99); // Unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update product price', async () => {
    const productId = await createTestProduct();
    
    const updateInput: UpdateProductInput = {
      id: productId,
      price: 39.99
    };

    const result = await updateProduct(updateInput);

    expect(result.id).toEqual(productId);
    expect(result.price).toEqual(39.99);
    expect(typeof result.price).toEqual('number');
    expect(result.name).toEqual('Original Product'); // Unchanged
  });

  it('should update multiple fields at once', async () => {
    const productId = await createTestProduct();
    
    const updateInput: UpdateProductInput = {
      id: productId,
      name: 'Multi-Updated Product',
      description: 'New description',
      price: 49.99,
      stock_quantity: 100,
      min_stock_level: 10,
      category: 'Updated Category',
      is_active: false
    };

    const result = await updateProduct(updateInput);

    expect(result.id).toEqual(productId);
    expect(result.name).toEqual('Multi-Updated Product');
    expect(result.description).toEqual('New description');
    expect(result.price).toEqual(49.99);
    expect(result.stock_quantity).toEqual(100);
    expect(result.min_stock_level).toEqual(10);
    expect(result.category).toEqual('Updated Category');
    expect(result.is_active).toEqual(false);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update nullable fields to null', async () => {
    const productId = await createTestProduct();
    
    const updateInput: UpdateProductInput = {
      id: productId,
      description: null,
      category: null,
      sku: null
    };

    const result = await updateProduct(updateInput);

    expect(result.id).toEqual(productId);
    expect(result.description).toBeNull();
    expect(result.category).toBeNull();
    expect(result.sku).toBeNull();
    expect(result.name).toEqual('Original Product'); // Unchanged
  });

  it('should persist changes to database', async () => {
    const productId = await createTestProduct();
    
    const updateInput: UpdateProductInput = {
      id: productId,
      name: 'Database Persisted Name',
      price: 79.99
    };

    await updateProduct(updateInput);

    // Verify changes persisted in database
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(products).toHaveLength(1);
    const dbProduct = products[0];
    expect(dbProduct.name).toEqual('Database Persisted Name');
    expect(parseFloat(dbProduct.price)).toEqual(79.99);
    expect(dbProduct.updated_at).toBeInstanceOf(Date);
  });

  it('should update SKU when unique', async () => {
    const productId = await createTestProduct();
    
    const updateInput: UpdateProductInput = {
      id: productId,
      sku: 'NEW-UNIQUE-SKU'
    };

    const result = await updateProduct(updateInput);

    expect(result.sku).toEqual('NEW-UNIQUE-SKU');
  });

  it('should throw error when product not found', async () => {
    const updateInput: UpdateProductInput = {
      id: 99999, // Non-existent ID
      name: 'Should Not Update'
    };

    await expect(updateProduct(updateInput)).rejects.toThrow(/Product with id 99999 not found/i);
  });

  it('should throw error when updating SKU to existing value', async () => {
    // Create two products
    const productId1 = await createTestProduct();
    
    // Create second product with different SKU
    const product2Result = await db.insert(productsTable)
      .values({
        name: 'Second Product',
        description: 'Second description',
        price: '19.99',
        stock_quantity: 25,
        min_stock_level: 2,
        category: 'Books',
        sku: 'SECOND-001'
      })
      .returning()
      .execute();
    
    const productId2 = product2Result[0].id;

    // Try to update second product with first product's SKU
    const updateInput: UpdateProductInput = {
      id: productId2,
      sku: 'ORIG-001' // This SKU already exists for productId1
    };

    await expect(updateProduct(updateInput)).rejects.toThrow(/SKU 'ORIG-001' already exists for another product/i);
  });

  it('should allow updating product with same SKU (no change)', async () => {
    const productId = await createTestProduct();
    
    const updateInput: UpdateProductInput = {
      id: productId,
      sku: 'ORIG-001', // Same as original SKU
      name: 'Updated Name'
    };

    const result = await updateProduct(updateInput);

    expect(result.sku).toEqual('ORIG-001');
    expect(result.name).toEqual('Updated Name');
  });

  it('should handle zero and negative values correctly', async () => {
    const productId = await createTestProduct();
    
    const updateInput: UpdateProductInput = {
      id: productId,
      price: 0.01, // Very small positive price
      stock_quantity: 0, // Zero stock
      min_stock_level: 0 // Zero minimum
    };

    const result = await updateProduct(updateInput);

    expect(result.price).toEqual(0.01);
    expect(result.stock_quantity).toEqual(0);
    expect(result.min_stock_level).toEqual(0);
  });

  it('should update updated_at timestamp', async () => {
    const productId = await createTestProduct();
    
    // Get original updated_at
    const originalProduct = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();
    
    const originalUpdatedAt = originalProduct[0].updated_at;

    // Small delay to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const updateInput: UpdateProductInput = {
      id: productId,
      name: 'Timestamp Test'
    };

    const result = await updateProduct(updateInput);

    // updated_at should be more recent than original
    expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });
});