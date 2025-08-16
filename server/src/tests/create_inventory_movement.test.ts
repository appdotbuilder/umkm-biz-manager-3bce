import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, inventoryMovementsTable } from '../db/schema';
import { type CreateInventoryMovementInput } from '../schema';
import { createInventoryMovement, adjustInventory } from '../handlers/create_inventory_movement';
import { eq } from 'drizzle-orm';

// Test product data
const testProduct = {
  name: 'Test Product',
  description: 'A product for testing inventory',
  price: '25.50',
  stock_quantity: 100,
  min_stock_level: 10,
  category: 'electronics',
  sku: 'TEST-001'
};

describe('createInventoryMovement', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let productId: number;

  beforeEach(async () => {
    // Create a test product
    const result = await db.insert(productsTable)
      .values(testProduct)
      .returning()
      .execute();
    productId = result[0].id;
  });

  it('should create inventory movement for stock in', async () => {
    const input: CreateInventoryMovementInput = {
      product_id: productId,
      movement_type: 'in',
      quantity: 50,
      reference_type: 'purchase',
      reference_id: 123,
      notes: 'Stock replenishment'
    };

    const result = await createInventoryMovement(input);

    expect(result.id).toBeDefined();
    expect(result.product_id).toEqual(productId);
    expect(result.movement_type).toEqual('in');
    expect(result.quantity).toEqual(50);
    expect(result.reference_type).toEqual('purchase');
    expect(result.reference_id).toEqual(123);
    expect(result.notes).toEqual('Stock replenishment');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should update product stock quantity for stock in movement', async () => {
    const input: CreateInventoryMovementInput = {
      product_id: productId,
      movement_type: 'in',
      quantity: 25,
      reference_type: 'purchase',
      reference_id: null,
      notes: null
    };

    await createInventoryMovement(input);

    // Check updated stock quantity
    const product = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(product[0].stock_quantity).toEqual(125); // 100 + 25
  });

  it('should create inventory movement for stock out', async () => {
    const input: CreateInventoryMovementInput = {
      product_id: productId,
      movement_type: 'out',
      quantity: 30,
      reference_type: 'sale',
      reference_id: 456,
      notes: 'Product sold'
    };

    const result = await createInventoryMovement(input);

    expect(result.movement_type).toEqual('out');
    expect(result.quantity).toEqual(30);
  });

  it('should update product stock quantity for stock out movement', async () => {
    const input: CreateInventoryMovementInput = {
      product_id: productId,
      movement_type: 'out',
      quantity: 20,
      reference_type: 'sale',
      reference_id: null,
      notes: null
    };

    await createInventoryMovement(input);

    // Check updated stock quantity
    const product = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(product[0].stock_quantity).toEqual(80); // 100 - 20
  });

  it('should create positive adjustment movement', async () => {
    const input: CreateInventoryMovementInput = {
      product_id: productId,
      movement_type: 'adjustment',
      quantity: 15,
      reference_type: 'correction',
      reference_id: null,
      notes: 'Stock count correction'
    };

    const result = await createInventoryMovement(input);

    expect(result.movement_type).toEqual('adjustment');
    expect(result.quantity).toEqual(15);
  });

  it('should create negative adjustment movement', async () => {
    const input: CreateInventoryMovementInput = {
      product_id: productId,
      movement_type: 'adjustment',
      quantity: -10,
      reference_type: 'correction',
      reference_id: null,
      notes: 'Damaged goods removed'
    };

    const result = await createInventoryMovement(input);

    expect(result.movement_type).toEqual('adjustment');
    expect(result.quantity).toEqual(-10);

    // Check updated stock quantity
    const product = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(product[0].stock_quantity).toEqual(90); // 100 - 10
  });

  it('should prevent stock out movements that result in negative stock', async () => {
    const input: CreateInventoryMovementInput = {
      product_id: productId,
      movement_type: 'out',
      quantity: 150, // More than available stock (100)
      reference_type: 'sale',
      reference_id: null,
      notes: null
    };

    await expect(createInventoryMovement(input)).rejects.toThrow(/insufficient stock/i);

    // Verify stock wasn't changed
    const product = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(product[0].stock_quantity).toEqual(100); // Original stock unchanged
  });

  it('should prevent negative adjustment that results in negative stock', async () => {
    const input: CreateInventoryMovementInput = {
      product_id: productId,
      movement_type: 'adjustment',
      quantity: -120, // More than available stock (100)
      reference_type: 'correction',
      reference_id: null,
      notes: 'Large adjustment'
    };

    await expect(createInventoryMovement(input)).rejects.toThrow(/insufficient stock/i);

    // Verify stock wasn't changed
    const product = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(product[0].stock_quantity).toEqual(100); // Original stock unchanged
  });

  it('should handle movement with null optional fields', async () => {
    const input: CreateInventoryMovementInput = {
      product_id: productId,
      movement_type: 'in',
      quantity: 5,
      reference_type: null,
      reference_id: null,
      notes: null
    };

    const result = await createInventoryMovement(input);

    expect(result.reference_type).toBeNull();
    expect(result.reference_id).toBeNull();
    expect(result.notes).toBeNull();
  });

  it('should fail when product does not exist', async () => {
    const input: CreateInventoryMovementInput = {
      product_id: 99999, // Non-existent product
      movement_type: 'in',
      quantity: 10,
      reference_type: null,
      reference_id: null,
      notes: null
    };

    await expect(createInventoryMovement(input)).rejects.toThrow(/product.*not found/i);
  });

  it('should save movement record to database', async () => {
    const input: CreateInventoryMovementInput = {
      product_id: productId,
      movement_type: 'in',
      quantity: 35,
      reference_type: 'restock',
      reference_id: 789,
      notes: 'Weekly restock'
    };

    const result = await createInventoryMovement(input);

    // Verify movement was saved
    const movements = await db.select()
      .from(inventoryMovementsTable)
      .where(eq(inventoryMovementsTable.id, result.id))
      .execute();

    expect(movements).toHaveLength(1);
    expect(movements[0].product_id).toEqual(productId);
    expect(movements[0].movement_type).toEqual('in');
    expect(movements[0].quantity).toEqual(35);
    expect(movements[0].reference_type).toEqual('restock');
    expect(movements[0].reference_id).toEqual(789);
    expect(movements[0].notes).toEqual('Weekly restock');
  });
});

describe('adjustInventory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let productId: number;

  beforeEach(async () => {
    // Create a test product
    const result = await db.insert(productsTable)
      .values(testProduct)
      .returning()
      .execute();
    productId = result[0].id;
  });

  it('should create adjustment movement with positive quantity', async () => {
    const result = await adjustInventory(productId, 25, 'Manual stock increase');

    expect(result.id).toBeDefined();
    expect(result.product_id).toEqual(productId);
    expect(result.movement_type).toEqual('adjustment');
    expect(result.quantity).toEqual(25);
    expect(result.reference_type).toEqual('manual');
    expect(result.reference_id).toBeNull();
    expect(result.notes).toEqual('Manual stock increase');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create adjustment movement with negative quantity', async () => {
    const result = await adjustInventory(productId, -15);

    expect(result.movement_type).toEqual('adjustment');
    expect(result.quantity).toEqual(-15);
    expect(result.notes).toBeNull();
  });

  it('should update product stock for positive adjustment', async () => {
    await adjustInventory(productId, 40, 'Stock correction');

    const product = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(product[0].stock_quantity).toEqual(140); // 100 + 40
  });

  it('should update product stock for negative adjustment', async () => {
    await adjustInventory(productId, -25, 'Damaged items removed');

    const product = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(product[0].stock_quantity).toEqual(75); // 100 - 25
  });

  it('should prevent adjustment that results in negative stock', async () => {
    await expect(adjustInventory(productId, -150, 'Large reduction'))
      .rejects.toThrow(/insufficient stock/i);

    // Verify stock wasn't changed
    const product = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    expect(product[0].stock_quantity).toEqual(100);
  });

  it('should handle adjustment without notes', async () => {
    const result = await adjustInventory(productId, 10);

    expect(result.notes).toBeNull();
  });

  it('should fail when product does not exist', async () => {
    await expect(adjustInventory(99999, 10, 'Test'))
      .rejects.toThrow(/product.*not found/i);
  });
});