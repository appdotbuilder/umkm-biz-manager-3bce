import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { inventoryMovementsTable, productsTable } from '../db/schema';
import { 
  getInventoryMovements, 
  getInventoryMovementsByProduct,
  getInventoryMovementsWithProductDetails,
  type GetInventoryMovementsParams 
} from '../handlers/get_inventory_movements';
import { eq, desc } from 'drizzle-orm';

describe('getInventoryMovements', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test product
  const createTestProduct = async (name: string = 'Test Product') => {
    const result = await db.insert(productsTable)
      .values({
        name,
        description: 'A test product',
        price: '19.99',
        stock_quantity: 100,
        min_stock_level: 10,
        category: 'test',
        sku: `TEST-${Date.now()}`
      })
      .returning()
      .execute();
    return result[0];
  };

  // Helper function to create test inventory movement
  const createTestMovement = async (productId: number, overrides: Partial<any> = {}) => {
    const result = await db.insert(inventoryMovementsTable)
      .values({
        product_id: productId,
        movement_type: 'in',
        quantity: 50,
        reference_type: 'adjustment',
        reference_id: 1,
        notes: 'Test movement',
        ...overrides
      })
      .returning()
      .execute();
    return result[0];
  };

  it('should fetch all inventory movements without filters', async () => {
    const product = await createTestProduct();
    await createTestMovement(product.id);
    await createTestMovement(product.id, { movement_type: 'out', quantity: 25 });

    const result = await getInventoryMovements();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: expect.any(Number),
      product_id: product.id,
      movement_type: expect.any(String),
      quantity: expect.any(Number),
      created_at: expect.any(Date)
    });
  });

  it('should filter by product_id', async () => {
    const product1 = await createTestProduct('Product 1');
    const product2 = await createTestProduct('Product 2');
    
    await createTestMovement(product1.id);
    await createTestMovement(product2.id);

    const input: GetInventoryMovementsParams = {
      product_id: product1.id
    };

    const result = await getInventoryMovements(input);

    expect(result).toHaveLength(1);
    expect(result[0].product_id).toEqual(product1.id);
  });

  it('should filter by movement_type', async () => {
    const product = await createTestProduct();
    await createTestMovement(product.id, { movement_type: 'in' });
    await createTestMovement(product.id, { movement_type: 'out' });
    await createTestMovement(product.id, { movement_type: 'adjustment' });

    const input: GetInventoryMovementsParams = {
      movement_type: 'out'
    };

    const result = await getInventoryMovements(input);

    expect(result).toHaveLength(1);
    expect(result[0].movement_type).toEqual('out');
  });

  it('should filter by date range', async () => {
    const product = await createTestProduct();
    
    // Create movement from yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Create movement for today
    const today = new Date();
    
    await createTestMovement(product.id);
    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));
    await createTestMovement(product.id, { quantity: 75 });

    const input: GetInventoryMovementsParams = {
      start_date: today
    };

    const result = await getInventoryMovements(input);

    expect(result.length).toBeGreaterThan(0);
    result.forEach(movement => {
      expect(movement.created_at >= today).toBe(true);
    });
  });

  it('should filter by reference_type and reference_id', async () => {
    const product = await createTestProduct();
    await createTestMovement(product.id, { reference_type: 'transaction', reference_id: 123 });
    await createTestMovement(product.id, { reference_type: 'adjustment', reference_id: 456 });

    const input: GetInventoryMovementsParams = {
      reference_type: 'transaction',
      reference_id: 123
    };

    const result = await getInventoryMovements(input);

    expect(result).toHaveLength(1);
    expect(result[0].reference_type).toEqual('transaction');
    expect(result[0].reference_id).toEqual(123);
  });

  it('should apply pagination correctly', async () => {
    const product = await createTestProduct();
    
    // Create 5 movements
    for (let i = 0; i < 5; i++) {
      await createTestMovement(product.id, { quantity: 10 + i });
    }

    const input: GetInventoryMovementsParams = {
      limit: 2,
      offset: 1
    };

    const result = await getInventoryMovements(input);

    expect(result).toHaveLength(2);
    
    // Verify pagination worked by getting all and comparing
    const allResults = await getInventoryMovements({ limit: 100 });
    expect(allResults).toHaveLength(5);
  });

  it('should order results correctly', async () => {
    const product = await createTestProduct();
    
    await createTestMovement(product.id, { quantity: 10 });
    await new Promise(resolve => setTimeout(resolve, 10));
    await createTestMovement(product.id, { quantity: 20 });
    await new Promise(resolve => setTimeout(resolve, 10));
    await createTestMovement(product.id, { quantity: 30 });

    // Test descending order (default)
    const descResult = await getInventoryMovements({
      order_by: 'created_at',
      order_direction: 'desc'
    });

    expect(descResult).toHaveLength(3);
    expect(descResult[0].created_at >= descResult[1].created_at).toBe(true);
    expect(descResult[1].created_at >= descResult[2].created_at).toBe(true);

    // Test ascending order
    const ascResult = await getInventoryMovements({
      order_by: 'created_at',
      order_direction: 'asc'
    });

    expect(ascResult).toHaveLength(3);
    expect(ascResult[0].created_at <= ascResult[1].created_at).toBe(true);
    expect(ascResult[1].created_at <= ascResult[2].created_at).toBe(true);
  });

  it('should handle multiple filters simultaneously', async () => {
    const product1 = await createTestProduct('Product 1');
    const product2 = await createTestProduct('Product 2');
    
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await createTestMovement(product1.id, { movement_type: 'in', quantity: 50 });
    await createTestMovement(product1.id, { movement_type: 'out', quantity: 25 });
    await createTestMovement(product2.id, { movement_type: 'in', quantity: 100 });

    const input: GetInventoryMovementsParams = {
      product_id: product1.id,
      movement_type: 'in',
      start_date: yesterday
    };

    const result = await getInventoryMovements(input);

    expect(result).toHaveLength(1);
    expect(result[0].product_id).toEqual(product1.id);
    expect(result[0].movement_type).toEqual('in');
    expect(result[0].quantity).toEqual(50);
  });

  it('should return empty array when no movements match filters', async () => {
    const product = await createTestProduct();
    await createTestMovement(product.id, { movement_type: 'in' });

    const input: GetInventoryMovementsParams = {
      movement_type: 'out'
    };

    const result = await getInventoryMovements(input);

    expect(result).toHaveLength(0);
  });
});

describe('getInventoryMovementsByProduct', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const createTestProduct = async (name: string = 'Test Product') => {
    const result = await db.insert(productsTable)
      .values({
        name,
        description: 'A test product',
        price: '19.99',
        stock_quantity: 100,
        min_stock_level: 10,
        category: 'test',
        sku: `TEST-${Date.now()}`
      })
      .returning()
      .execute();
    return result[0];
  };

  const createTestMovement = async (productId: number, overrides: Partial<any> = {}) => {
    const result = await db.insert(inventoryMovementsTable)
      .values({
        product_id: productId,
        movement_type: 'in',
        quantity: 50,
        reference_type: 'adjustment',
        reference_id: 1,
        notes: 'Test movement',
        ...overrides
      })
      .returning()
      .execute();
    return result[0];
  };

  it('should fetch movements for specific product', async () => {
    const product1 = await createTestProduct('Product 1');
    const product2 = await createTestProduct('Product 2');
    
    await createTestMovement(product1.id, { quantity: 25 });
    await createTestMovement(product1.id, { quantity: 50 });
    await createTestMovement(product2.id, { quantity: 100 });

    const result = await getInventoryMovementsByProduct(product1.id);

    expect(result).toHaveLength(2);
    result.forEach(movement => {
      expect(movement.product_id).toEqual(product1.id);
    });
  });

  it('should order movements by created_at descending', async () => {
    const product = await createTestProduct();
    
    await createTestMovement(product.id, { quantity: 10 });
    await new Promise(resolve => setTimeout(resolve, 10));
    await createTestMovement(product.id, { quantity: 20 });
    await new Promise(resolve => setTimeout(resolve, 10));
    await createTestMovement(product.id, { quantity: 30 });

    const result = await getInventoryMovementsByProduct(product.id);

    expect(result).toHaveLength(3);
    // Should be ordered by created_at descending
    expect(result[0].created_at >= result[1].created_at).toBe(true);
    expect(result[1].created_at >= result[2].created_at).toBe(true);
  });

  it('should return empty array for non-existent product', async () => {
    const result = await getInventoryMovementsByProduct(999);

    expect(result).toHaveLength(0);
  });

  it('should return empty array for product with no movements', async () => {
    const product = await createTestProduct();

    const result = await getInventoryMovementsByProduct(product.id);

    expect(result).toHaveLength(0);
  });

  it('should handle all movement types', async () => {
    const product = await createTestProduct();
    
    await createTestMovement(product.id, { movement_type: 'in', quantity: 50 });
    await createTestMovement(product.id, { movement_type: 'out', quantity: 25 });
    await createTestMovement(product.id, { movement_type: 'adjustment', quantity: 10 });

    const result = await getInventoryMovementsByProduct(product.id);

    expect(result).toHaveLength(3);
    
    const movementTypes = result.map(m => m.movement_type);
    expect(movementTypes).toContain('in');
    expect(movementTypes).toContain('out');
    expect(movementTypes).toContain('adjustment');
  });
});

describe('getInventoryMovementsWithProductDetails', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const createTestProduct = async (name: string = 'Test Product') => {
    const result = await db.insert(productsTable)
      .values({
        name,
        description: 'A test product',
        price: '19.99',
        stock_quantity: 100,
        min_stock_level: 10,
        category: 'test',
        sku: `TEST-${Date.now()}`
      })
      .returning()
      .execute();
    return result[0];
  };

  const createTestMovement = async (productId: number, overrides: Partial<any> = {}) => {
    const result = await db.insert(inventoryMovementsTable)
      .values({
        product_id: productId,
        movement_type: 'in',
        quantity: 50,
        reference_type: 'adjustment',
        reference_id: 1,
        notes: 'Test movement',
        ...overrides
      })
      .returning()
      .execute();
    return result[0];
  };

  it('should fetch movements with product details', async () => {
    const product = await createTestProduct('Test Widget');
    await createTestMovement(product.id, { quantity: 75 });

    const result = await getInventoryMovementsWithProductDetails();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: expect.any(Number),
      product_id: product.id,
      product_name: 'Test Widget',
      movement_type: 'in',
      quantity: 75,
      created_at: expect.any(Date)
    });
  });

  it('should apply filters correctly with product details', async () => {
    const product1 = await createTestProduct('Widget A');
    const product2 = await createTestProduct('Widget B');
    
    await createTestMovement(product1.id, { movement_type: 'in' });
    await createTestMovement(product2.id, { movement_type: 'out' });

    const input: GetInventoryMovementsParams = {
      movement_type: 'out'
    };

    const result = await getInventoryMovementsWithProductDetails(input);

    expect(result).toHaveLength(1);
    expect(result[0].product_name).toEqual('Widget B');
    expect(result[0].movement_type).toEqual('out');
  });

  it('should handle pagination with product details', async () => {
    const product1 = await createTestProduct('Product 1');
    const product2 = await createTestProduct('Product 2');
    
    await createTestMovement(product1.id);
    await createTestMovement(product2.id);
    await createTestMovement(product1.id, { quantity: 25 });

    const input: GetInventoryMovementsParams = {
      limit: 2,
      offset: 1
    };

    const result = await getInventoryMovementsWithProductDetails(input);

    expect(result).toHaveLength(2);
    result.forEach(movement => {
      expect(movement.product_name).toBeDefined();
      expect(typeof movement.product_name).toBe('string');
    });
  });
});