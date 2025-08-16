import { z } from 'zod';
import { db } from '../db';
import { inventoryMovementsTable, productsTable } from '../db/schema';
import { type InventoryMovement, inventoryMovementTypeSchema } from '../schema';
import { eq, and, gte, lte, desc, SQL } from 'drizzle-orm';

// Input schema for filtering inventory movements
export const getInventoryMovementsInputSchema = z.object({
  product_id: z.number().optional(),
  movement_type: inventoryMovementTypeSchema.optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  reference_type: z.string().optional(),
  reference_id: z.number().optional(),
  limit: z.number().int().positive().optional().default(100),
  offset: z.number().int().nonnegative().optional().default(0),
  order_by: z.enum(['created_at', 'quantity']).optional().default('created_at'),
  order_direction: z.enum(['asc', 'desc']).optional().default('desc')
});

export type GetInventoryMovementsInput = z.infer<typeof getInventoryMovementsInputSchema>;

// For function parameters, we need a type that allows partial input
export type GetInventoryMovementsParams = {
  product_id?: number;
  movement_type?: z.infer<typeof inventoryMovementTypeSchema>;
  start_date?: Date;
  end_date?: Date;
  reference_type?: string;
  reference_id?: number;
  limit?: number;
  offset?: number;
  order_by?: 'created_at' | 'quantity';
  order_direction?: 'asc' | 'desc';
};

// Enhanced inventory movement with product details
export const inventoryMovementWithProductSchema = z.object({
  id: z.number(),
  product_id: z.number(),
  product_name: z.string(),
  movement_type: inventoryMovementTypeSchema,
  quantity: z.number().int(),
  reference_type: z.string().nullable(),
  reference_id: z.number().nullable(),
  notes: z.string().nullable(),
  created_at: z.coerce.date()
});

export type InventoryMovementWithProduct = z.infer<typeof inventoryMovementWithProductSchema>;

export async function getInventoryMovements(input: GetInventoryMovementsParams = {}): Promise<InventoryMovement[]> {
  try {
    // Apply defaults
    const params = {
      limit: input.limit ?? 100,
      offset: input.offset ?? 0,
      order_by: input.order_by ?? 'created_at',
      order_direction: input.order_direction ?? 'desc',
      ...input
    };

    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    if (params.product_id !== undefined) {
      conditions.push(eq(inventoryMovementsTable.product_id, params.product_id));
    }

    if (params.movement_type !== undefined) {
      conditions.push(eq(inventoryMovementsTable.movement_type, params.movement_type));
    }

    if (params.start_date !== undefined) {
      conditions.push(gte(inventoryMovementsTable.created_at, params.start_date));
    }

    if (params.end_date !== undefined) {
      conditions.push(lte(inventoryMovementsTable.created_at, params.end_date));
    }

    if (params.reference_type !== undefined) {
      conditions.push(eq(inventoryMovementsTable.reference_type, params.reference_type));
    }

    if (params.reference_id !== undefined) {
      conditions.push(eq(inventoryMovementsTable.reference_id, params.reference_id));
    }

    // Build query in one chain to maintain types
    let baseQuery = db.select().from(inventoryMovementsTable);

    // Apply where clause if conditions exist
    let queryWithWhere = conditions.length > 0 
      ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : baseQuery;

    // Apply ordering
    let queryWithOrder = params.order_direction === 'desc'
      ? queryWithWhere.orderBy(desc(inventoryMovementsTable[params.order_by]))
      : queryWithWhere.orderBy(inventoryMovementsTable[params.order_by]);

    // Apply pagination and execute
    const results = await queryWithOrder
      .limit(params.limit)
      .offset(params.offset)
      .execute();

    // Convert numeric fields back to numbers
    return results.map(movement => ({
      ...movement,
      // Note: quantity is integer, no conversion needed
      // created_at is already a Date object from timestamp column
    }));
  } catch (error) {
    console.error('Fetching inventory movements failed:', error);
    throw error;
  }
}

export async function getInventoryMovementsByProduct(productId: number): Promise<InventoryMovement[]> {
  try {
    const results = await db.select()
      .from(inventoryMovementsTable)
      .where(eq(inventoryMovementsTable.product_id, productId))
      .orderBy(desc(inventoryMovementsTable.created_at))
      .execute();

    return results.map(movement => ({
      ...movement,
      // Note: quantity is integer, no conversion needed
      // created_at is already a Date object from timestamp column
    }));
  } catch (error) {
    console.error('Fetching inventory movements by product failed:', error);
    throw error;
  }
}

export async function getInventoryMovementsWithProductDetails(input: GetInventoryMovementsParams = {}): Promise<InventoryMovementWithProduct[]> {
  try {
    // Apply defaults
    const params = {
      limit: input.limit ?? 100,
      offset: input.offset ?? 0,
      order_by: input.order_by ?? 'created_at',
      order_direction: input.order_direction ?? 'desc',
      ...input
    };

    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    if (params.product_id !== undefined) {
      conditions.push(eq(inventoryMovementsTable.product_id, params.product_id));
    }

    if (params.movement_type !== undefined) {
      conditions.push(eq(inventoryMovementsTable.movement_type, params.movement_type));
    }

    if (params.start_date !== undefined) {
      conditions.push(gte(inventoryMovementsTable.created_at, params.start_date));
    }

    if (params.end_date !== undefined) {
      conditions.push(lte(inventoryMovementsTable.created_at, params.end_date));
    }

    if (params.reference_type !== undefined) {
      conditions.push(eq(inventoryMovementsTable.reference_type, params.reference_type));
    }

    if (params.reference_id !== undefined) {
      conditions.push(eq(inventoryMovementsTable.reference_id, params.reference_id));
    }

    // Build query with join first
    let baseQuery = db.select({
      id: inventoryMovementsTable.id,
      product_id: inventoryMovementsTable.product_id,
      product_name: productsTable.name,
      movement_type: inventoryMovementsTable.movement_type,
      quantity: inventoryMovementsTable.quantity,
      reference_type: inventoryMovementsTable.reference_type,
      reference_id: inventoryMovementsTable.reference_id,
      notes: inventoryMovementsTable.notes,
      created_at: inventoryMovementsTable.created_at
    })
    .from(inventoryMovementsTable)
    .innerJoin(productsTable, eq(inventoryMovementsTable.product_id, productsTable.id));

    // Apply where clause if conditions exist
    let queryWithWhere = conditions.length > 0 
      ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : baseQuery;

    // Apply ordering
    let queryWithOrder = params.order_direction === 'desc'
      ? queryWithWhere.orderBy(desc(inventoryMovementsTable[params.order_by]))
      : queryWithWhere.orderBy(inventoryMovementsTable[params.order_by]);

    // Apply pagination and execute
    const results = await queryWithOrder
      .limit(params.limit)
      .offset(params.offset)
      .execute();

    return results.map(movement => ({
      ...movement,
      // Note: quantity is integer, no conversion needed
      // created_at is already a Date object from timestamp column
    }));
  } catch (error) {
    console.error('Fetching inventory movements with product details failed:', error);
    throw error;
  }
}