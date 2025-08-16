import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable } from '../db/schema';
import { type CreateProductInput } from '../schema';
import { generateInventoryReport, getStockAlerts } from '../handlers/generate_inventory_report';
import { eq } from 'drizzle-orm';

// Test product inputs
const testProducts = [
  {
    name: 'Product A',
    description: 'Normal stock product',
    price: 10.99,
    stock_quantity: 50,
    min_stock_level: 10,
    category: 'Electronics',
    sku: 'PROD-A-001'
  },
  {
    name: 'Product B',
    description: 'Low stock product',
    price: 25.50,
    stock_quantity: 5,
    min_stock_level: 10,
    category: 'Books',
    sku: 'PROD-B-002'
  },
  {
    name: 'Product C',
    description: 'Out of stock product',
    price: 15.75,
    stock_quantity: 0,
    min_stock_level: 5,
    category: 'Clothing',
    sku: 'PROD-C-003'
  },
  {
    name: 'Product D',
    description: 'Another low stock product',
    price: 8.25,
    stock_quantity: 2,
    min_stock_level: 8,
    category: 'Electronics',
    sku: 'PROD-D-004'
  },
  {
    name: 'Product E',
    description: 'Inactive product',
    price: 100.00,
    stock_quantity: 20,
    min_stock_level: 5,
    category: 'Electronics',
    sku: 'PROD-E-005'
  }
] as CreateProductInput[];

describe('generateInventoryReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate comprehensive inventory report', async () => {
    // Create test products
    const createdProducts = [];
    for (const product of testProducts) {
      const result = await db.insert(productsTable)
        .values({
          ...product,
          price: product.price.toString()
        })
        .returning()
        .execute();
      createdProducts.push(result[0]);
    }

    // Make one product inactive
    await db.update(productsTable)
      .set({ is_active: false })
      .where(eq(productsTable.id, createdProducts[4].id))
      .execute();

    const report = await generateInventoryReport();

    // Verify total products (only active ones)
    expect(report.total_products).toBe(4);

    // Verify low stock products (Product B and Product D)
    expect(report.low_stock_products).toHaveLength(2);
    
    const lowStockNames = report.low_stock_products.map(p => p.product_name);
    expect(lowStockNames).toContain('Product B');
    expect(lowStockNames).toContain('Product D');

    // Check low stock product details
    const productB = report.low_stock_products.find(p => p.product_name === 'Product B');
    expect(productB).toBeDefined();
    expect(productB!.current_stock).toBe(5);
    expect(productB!.min_stock_level).toBe(10);

    // Verify out of stock products (Product C)
    expect(report.out_of_stock_products).toHaveLength(1);
    expect(report.out_of_stock_products[0].product_name).toBe('Product C');

    // Verify total inventory value calculation
    // Product A: 50 * 10.99 = 549.50
    // Product B: 5 * 25.50 = 127.50
    // Product C: 0 * 15.75 = 0
    // Product D: 2 * 8.25 = 16.50
    // Total: 693.50
    expect(report.total_inventory_value).toBeCloseTo(693.50, 2);
  });

  it('should handle empty inventory', async () => {
    const report = await generateInventoryReport();

    expect(report.total_products).toBe(0);
    expect(report.low_stock_products).toHaveLength(0);
    expect(report.out_of_stock_products).toHaveLength(0);
    expect(report.total_inventory_value).toBe(0);
  });

  it('should handle all products with adequate stock', async () => {
    // Create products with adequate stock
    const adequateStockProduct = {
      name: 'Well Stocked Product',
      description: 'Product with good stock',
      price: 20.00,
      stock_quantity: 100,
      min_stock_level: 10,
      category: 'Test',
      sku: 'WELL-001'
    };

    await db.insert(productsTable)
      .values({
        ...adequateStockProduct,
        price: adequateStockProduct.price.toString()
      })
      .execute();

    const report = await generateInventoryReport();

    expect(report.total_products).toBe(1);
    expect(report.low_stock_products).toHaveLength(0);
    expect(report.out_of_stock_products).toHaveLength(0);
    expect(report.total_inventory_value).toBe(2000.00);
  });

  it('should exclude inactive products from report', async () => {
    // Create one active and one inactive product
    const activeProduct = testProducts[0];
    const inactiveProduct = testProducts[1];

    await db.insert(productsTable)
      .values([
        {
          ...activeProduct,
          price: activeProduct.price.toString()
        },
        {
          ...inactiveProduct,
          price: inactiveProduct.price.toString(),
          is_active: false
        }
      ])
      .execute();

    const report = await generateInventoryReport();

    expect(report.total_products).toBe(1);
    expect(report.low_stock_products).toHaveLength(0);
    expect(report.out_of_stock_products).toHaveLength(0);
    expect(report.total_inventory_value).toBeCloseTo(549.50, 2);
  });
});

describe('getStockAlerts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return stock alerts for dashboard', async () => {
    // Create test products
    for (const product of testProducts.slice(0, 4)) {
      await db.insert(productsTable)
        .values({
          ...product,
          price: product.price.toString()
        })
        .execute();
    }

    const alerts = await getStockAlerts();

    // Verify low stock alerts
    expect(alerts.low_stock).toHaveLength(2);
    const lowStockNames = alerts.low_stock.map(p => p.name);
    expect(lowStockNames).toContain('Product B');
    expect(lowStockNames).toContain('Product D');

    // Check low stock alert details
    const productB = alerts.low_stock.find(p => p.name === 'Product B');
    expect(productB).toBeDefined();
    expect(productB!.current_stock).toBe(5);
    expect(productB!.min_stock_level).toBe(10);
    expect(typeof productB!.price).toBe('number');
    expect(productB!.price).toBe(25.50);
    expect(productB!.category).toBe('Books');
    expect(productB!.sku).toBe('PROD-B-002');

    // Verify out of stock alerts
    expect(alerts.out_of_stock).toHaveLength(1);
    expect(alerts.out_of_stock[0].name).toBe('Product C');
    
    const productC = alerts.out_of_stock[0];
    expect(typeof productC.price).toBe('number');
    expect(productC.price).toBe(15.75);
    expect(productC.category).toBe('Clothing');
    expect(productC.sku).toBe('PROD-C-003');
  });

  it('should return empty alerts when no stock issues', async () => {
    // Create product with adequate stock
    const goodStockProduct = {
      name: 'Good Stock Product',
      description: 'Product with adequate stock',
      price: 30.00,
      stock_quantity: 50,
      min_stock_level: 10,
      category: 'Test',
      sku: 'GOOD-001'
    };

    await db.insert(productsTable)
      .values({
        ...goodStockProduct,
        price: goodStockProduct.price.toString()
      })
      .execute();

    const alerts = await getStockAlerts();

    expect(alerts.low_stock).toHaveLength(0);
    expect(alerts.out_of_stock).toHaveLength(0);
  });

  it('should exclude inactive products from alerts', async () => {
    // Create low stock product but make it inactive
    const lowStockProduct = testProducts[1]; // Product B - low stock

    await db.insert(productsTable)
      .values({
        ...lowStockProduct,
        price: lowStockProduct.price.toString(),
        is_active: false
      })
      .execute();

    const alerts = await getStockAlerts();

    expect(alerts.low_stock).toHaveLength(0);
    expect(alerts.out_of_stock).toHaveLength(0);
  });

  it('should handle edge case where stock equals min stock level', async () => {
    // Product with stock exactly at minimum level
    const edgeCaseProduct = {
      name: 'Edge Case Product',
      description: 'Stock equals min level',
      price: 12.99,
      stock_quantity: 5,
      min_stock_level: 5,
      category: 'Test',
      sku: 'EDGE-001'
    };

    await db.insert(productsTable)
      .values({
        ...edgeCaseProduct,
        price: edgeCaseProduct.price.toString()
      })
      .execute();

    const alerts = await getStockAlerts();

    // Should appear in low stock since stock_quantity <= min_stock_level
    expect(alerts.low_stock).toHaveLength(1);
    expect(alerts.low_stock[0].name).toBe('Edge Case Product');
    expect(alerts.low_stock[0].current_stock).toBe(5);
    expect(alerts.low_stock[0].min_stock_level).toBe(5);
  });
});