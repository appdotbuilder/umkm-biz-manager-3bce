import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable } from '../db/schema';
import { type CreateProductInput } from '../schema';
import { createProduct } from '../handlers/create_product';
import { eq } from 'drizzle-orm';

// Complete test input with all required fields
const testInput: CreateProductInput = {
  name: 'Test Product',
  description: 'A product for testing',
  price: 19.99,
  stock_quantity: 100,
  min_stock_level: 10, // Include explicit value even though it has default
  category: 'Electronics',
  sku: 'TEST-001'
};

// Test input with minimal required fields
const minimalInput: CreateProductInput = {
  name: 'Minimal Product',
  description: null,
  price: 5.50,
  stock_quantity: 0,
  min_stock_level: 0, // Include even for minimal input
  category: null,
  sku: null
};

describe('createProduct', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a product with all fields', async () => {
    const result = await createProduct(testInput);

    // Verify all field values and types
    expect(result.name).toEqual('Test Product');
    expect(result.description).toEqual('A product for testing');
    expect(result.price).toEqual(19.99);
    expect(typeof result.price).toBe('number'); // Verify numeric conversion
    expect(result.stock_quantity).toEqual(100);
    expect(result.min_stock_level).toEqual(10);
    expect(result.category).toEqual('Electronics');
    expect(result.sku).toEqual('TEST-001');
    expect(result.is_active).toEqual(true); // Default value
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a product with minimal fields and apply defaults', async () => {
    const result = await createProduct(minimalInput);

    expect(result.name).toEqual('Minimal Product');
    expect(result.description).toBeNull();
    expect(result.price).toEqual(5.50);
    expect(typeof result.price).toBe('number');
    expect(result.stock_quantity).toEqual(0);
    expect(result.min_stock_level).toEqual(0); // Zod default applied
    expect(result.category).toBeNull();
    expect(result.sku).toBeNull();
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
  });

  it('should save product to database correctly', async () => {
    const result = await createProduct(testInput);

    // Query database to verify persistence
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, result.id))
      .execute();

    expect(products).toHaveLength(1);
    const savedProduct = products[0];
    
    expect(savedProduct.name).toEqual('Test Product');
    expect(savedProduct.description).toEqual('A product for testing');
    expect(parseFloat(savedProduct.price)).toEqual(19.99); // DB stores as string
    expect(savedProduct.stock_quantity).toEqual(100);
    expect(savedProduct.min_stock_level).toEqual(10);
    expect(savedProduct.category).toEqual('Electronics');
    expect(savedProduct.sku).toEqual('TEST-001');
    expect(savedProduct.is_active).toEqual(true);
    expect(savedProduct.created_at).toBeInstanceOf(Date);
    expect(savedProduct.updated_at).toBeInstanceOf(Date);
  });

  it('should handle duplicate SKU constraint violation', async () => {
    // Create first product with SKU
    await createProduct(testInput);

    // Attempt to create second product with same SKU
    const duplicateInput: CreateProductInput = {
      ...testInput,
      name: 'Duplicate SKU Product'
    };

    await expect(createProduct(duplicateInput))
      .rejects.toThrow(/unique|duplicate/i);
  });

  it('should allow multiple products with null SKU', async () => {
    const input1: CreateProductInput = {
      name: 'Product 1',
      description: null,
      price: 10.00,
      stock_quantity: 50,
      min_stock_level: 5,
      category: null,
      sku: null
    };

    const input2: CreateProductInput = {
      name: 'Product 2',
      description: null,
      price: 15.00,
      stock_quantity: 30,
      min_stock_level: 3,
      category: null,
      sku: null
    };

    // Both should succeed since null SKUs are allowed
    const result1 = await createProduct(input1);
    const result2 = await createProduct(input2);

    expect(result1.id).toBeDefined();
    expect(result2.id).toBeDefined();
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.sku).toBeNull();
    expect(result2.sku).toBeNull();
  });

  it('should handle various price formats correctly', async () => {
    const preciseInput: CreateProductInput = {
      name: 'Precise Price Product',
      description: null,
      price: 123.456789, // More than 2 decimal places
      stock_quantity: 1,
      min_stock_level: 0,
      category: null,
      sku: null
    };

    const result = await createProduct(preciseInput);

    // Verify price handling with proper precision
    expect(typeof result.price).toBe('number');
    expect(result.price).toBeCloseTo(123.46, 2); // Should round to 2 decimal places
  });

  it('should create multiple products successfully', async () => {
    const inputs: CreateProductInput[] = [
      {
        name: 'Product A',
        description: 'First product',
        price: 10.00,
        stock_quantity: 100,
        min_stock_level: 10,
        category: 'Category A',
        sku: 'SKU-A'
      },
      {
        name: 'Product B',
        description: 'Second product',
        price: 20.00,
        stock_quantity: 200,
        min_stock_level: 20,
        category: 'Category B',
        sku: 'SKU-B'
      }
    ];

    const results = await Promise.all(inputs.map(input => createProduct(input)));

    expect(results).toHaveLength(2);
    expect(results[0].name).toEqual('Product A');
    expect(results[1].name).toEqual('Product B');
    expect(results[0].id).not.toEqual(results[1].id);

    // Verify both are in database
    const allProducts = await db.select().from(productsTable).execute();
    expect(allProducts).toHaveLength(2);
  });
});