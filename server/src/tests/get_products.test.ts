import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable } from '../db/schema';
import { type CreateProductInput } from '../schema';
import { getProducts, getProductById, getLowStockProducts } from '../handlers/get_products';

// Test product data
const testProduct1: CreateProductInput = {
  name: 'Test Product 1',
  description: 'First test product',
  price: 19.99,
  stock_quantity: 100,
  min_stock_level: 10,
  category: 'electronics',
  sku: 'TEST001'
};

const testProduct2: CreateProductInput = {
  name: 'Test Product 2',
  description: 'Second test product',
  price: 29.99,
  stock_quantity: 5,
  min_stock_level: 10,
  category: 'clothing',
  sku: 'TEST002'
};

const testProduct3: CreateProductInput = {
  name: 'Inactive Product',
  description: 'This product is inactive',
  price: 39.99,
  stock_quantity: 50,
  min_stock_level: 5,
  category: 'books',
  sku: 'TEST003'
};

const outOfStockProduct: CreateProductInput = {
  name: 'Out of Stock Product',
  description: 'Product with zero stock',
  price: 49.99,
  stock_quantity: 0,
  min_stock_level: 5,
  category: 'toys',
  sku: 'TEST004'
};

describe('getProducts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all active products', async () => {
    // Create test products
    await db.insert(productsTable).values({
      name: testProduct1.name,
      description: testProduct1.description,
      price: testProduct1.price.toString(),
      stock_quantity: testProduct1.stock_quantity,
      min_stock_level: testProduct1.min_stock_level,
      category: testProduct1.category,
      sku: testProduct1.sku,
      is_active: true
    }).execute();

    await db.insert(productsTable).values({
      name: testProduct2.name,
      description: testProduct2.description,
      price: testProduct2.price.toString(),
      stock_quantity: testProduct2.stock_quantity,
      min_stock_level: testProduct2.min_stock_level,
      category: testProduct2.category,
      sku: testProduct2.sku,
      is_active: true
    }).execute();

    const result = await getProducts();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Test Product 1');
    expect(result[0].price).toBe(19.99);
    expect(typeof result[0].price).toBe('number');
    expect(result[1].name).toBe('Test Product 2');
    expect(result[1].price).toBe(29.99);
    expect(typeof result[1].price).toBe('number');
  });

  it('should not return inactive products', async () => {
    // Create active product
    await db.insert(productsTable).values({
      name: testProduct1.name,
      description: testProduct1.description,
      price: testProduct1.price.toString(),
      stock_quantity: testProduct1.stock_quantity,
      min_stock_level: testProduct1.min_stock_level,
      category: testProduct1.category,
      sku: testProduct1.sku,
      is_active: true
    }).execute();

    // Create inactive product
    await db.insert(productsTable).values({
      name: testProduct3.name,
      description: testProduct3.description,
      price: testProduct3.price.toString(),
      stock_quantity: testProduct3.stock_quantity,
      min_stock_level: testProduct3.min_stock_level,
      category: testProduct3.category,
      sku: testProduct3.sku,
      is_active: false
    }).execute();

    const result = await getProducts();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Test Product 1');
    expect(result[0].is_active).toBe(true);
  });

  it('should return empty array when no active products exist', async () => {
    const result = await getProducts();
    expect(result).toHaveLength(0);
  });

  it('should convert numeric price field correctly', async () => {
    await db.insert(productsTable).values({
      name: testProduct1.name,
      description: testProduct1.description,
      price: testProduct1.price.toString(),
      stock_quantity: testProduct1.stock_quantity,
      min_stock_level: testProduct1.min_stock_level,
      category: testProduct1.category,
      sku: testProduct1.sku,
      is_active: true
    }).execute();

    const result = await getProducts();

    expect(result).toHaveLength(1);
    expect(typeof result[0].price).toBe('number');
    expect(result[0].price).toBe(19.99);
  });
});

describe('getProductById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return product by id when it exists and is active', async () => {
    const insertResult = await db.insert(productsTable).values({
      name: testProduct1.name,
      description: testProduct1.description,
      price: testProduct1.price.toString(),
      stock_quantity: testProduct1.stock_quantity,
      min_stock_level: testProduct1.min_stock_level,
      category: testProduct1.category,
      sku: testProduct1.sku,
      is_active: true
    }).returning().execute();

    const productId = insertResult[0].id;
    const result = await getProductById(productId);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(productId);
    expect(result!.name).toBe('Test Product 1');
    expect(result!.price).toBe(19.99);
    expect(typeof result!.price).toBe('number');
    expect(result!.stock_quantity).toBe(100);
    expect(result!.is_active).toBe(true);
  });

  it('should return null when product does not exist', async () => {
    const result = await getProductById(999);
    expect(result).toBeNull();
  });

  it('should return null when product exists but is inactive', async () => {
    const insertResult = await db.insert(productsTable).values({
      name: testProduct3.name,
      description: testProduct3.description,
      price: testProduct3.price.toString(),
      stock_quantity: testProduct3.stock_quantity,
      min_stock_level: testProduct3.min_stock_level,
      category: testProduct3.category,
      sku: testProduct3.sku,
      is_active: false
    }).returning().execute();

    const productId = insertResult[0].id;
    const result = await getProductById(productId);

    expect(result).toBeNull();
  });

  it('should convert numeric price field correctly', async () => {
    const insertResult = await db.insert(productsTable).values({
      name: testProduct1.name,
      description: testProduct1.description,
      price: testProduct1.price.toString(),
      stock_quantity: testProduct1.stock_quantity,
      min_stock_level: testProduct1.min_stock_level,
      category: testProduct1.category,
      sku: testProduct1.sku,
      is_active: true
    }).returning().execute();

    const productId = insertResult[0].id;
    const result = await getProductById(productId);

    expect(result).not.toBeNull();
    expect(typeof result!.price).toBe('number');
    expect(result!.price).toBe(19.99);
  });
});

describe('getLowStockProducts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return products where stock is at or below minimum level', async () => {
    // Create product with low stock (5 <= 10)
    await db.insert(productsTable).values({
      name: testProduct2.name,
      description: testProduct2.description,
      price: testProduct2.price.toString(),
      stock_quantity: testProduct2.stock_quantity, // 5
      min_stock_level: testProduct2.min_stock_level, // 10
      category: testProduct2.category,
      sku: testProduct2.sku,
      is_active: true
    }).execute();

    // Create product with adequate stock (100 > 10)
    await db.insert(productsTable).values({
      name: testProduct1.name,
      description: testProduct1.description,
      price: testProduct1.price.toString(),
      stock_quantity: testProduct1.stock_quantity, // 100
      min_stock_level: testProduct1.min_stock_level, // 10
      category: testProduct1.category,
      sku: testProduct1.sku,
      is_active: true
    }).execute();

    const result = await getLowStockProducts();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Test Product 2');
    expect(result[0].stock_quantity).toBe(5);
    expect(result[0].min_stock_level).toBe(10);
    expect(result[0].price).toBe(29.99);
    expect(typeof result[0].price).toBe('number');
  });

  it('should return products with zero stock', async () => {
    await db.insert(productsTable).values({
      name: outOfStockProduct.name,
      description: outOfStockProduct.description,
      price: outOfStockProduct.price.toString(),
      stock_quantity: outOfStockProduct.stock_quantity, // 0
      min_stock_level: outOfStockProduct.min_stock_level, // 5
      category: outOfStockProduct.category,
      sku: outOfStockProduct.sku,
      is_active: true
    }).execute();

    const result = await getLowStockProducts();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Out of Stock Product');
    expect(result[0].stock_quantity).toBe(0);
    expect(result[0].min_stock_level).toBe(5);
  });

  it('should not return inactive products even if they have low stock', async () => {
    // Create inactive product with low stock
    await db.insert(productsTable).values({
      name: testProduct2.name,
      description: testProduct2.description,
      price: testProduct2.price.toString(),
      stock_quantity: testProduct2.stock_quantity, // 5
      min_stock_level: testProduct2.min_stock_level, // 10
      category: testProduct2.category,
      sku: testProduct2.sku,
      is_active: false
    }).execute();

    const result = await getLowStockProducts();

    expect(result).toHaveLength(0);
  });

  it('should return empty array when no products have low stock', async () => {
    // Create product with adequate stock
    await db.insert(productsTable).values({
      name: testProduct1.name,
      description: testProduct1.description,
      price: testProduct1.price.toString(),
      stock_quantity: testProduct1.stock_quantity, // 100
      min_stock_level: testProduct1.min_stock_level, // 10
      category: testProduct1.category,
      sku: testProduct1.sku,
      is_active: true
    }).execute();

    const result = await getLowStockProducts();

    expect(result).toHaveLength(0);
  });

  it('should return products where stock equals minimum level', async () => {
    // Create product where stock exactly equals minimum level
    await db.insert(productsTable).values({
      name: 'Equal Stock Product',
      description: 'Stock equals minimum',
      price: '25.99',
      stock_quantity: 10, // Equals min_stock_level
      min_stock_level: 10,
      category: 'test',
      sku: 'TEST005',
      is_active: true
    }).execute();

    const result = await getLowStockProducts();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Equal Stock Product');
    expect(result[0].stock_quantity).toBe(10);
    expect(result[0].min_stock_level).toBe(10);
  });

  it('should convert numeric price field correctly', async () => {
    await db.insert(productsTable).values({
      name: testProduct2.name,
      description: testProduct2.description,
      price: testProduct2.price.toString(),
      stock_quantity: testProduct2.stock_quantity,
      min_stock_level: testProduct2.min_stock_level,
      category: testProduct2.category,
      sku: testProduct2.sku,
      is_active: true
    }).execute();

    const result = await getLowStockProducts();

    expect(result).toHaveLength(1);
    expect(typeof result[0].price).toBe('number');
    expect(result[0].price).toBe(29.99);
  });
});