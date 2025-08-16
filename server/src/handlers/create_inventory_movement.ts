import { db } from '../db';
import { inventoryMovementsTable, productsTable } from '../db/schema';
import { type CreateInventoryMovementInput, type InventoryMovement } from '../schema';
import { eq, sql } from 'drizzle-orm';

export async function createInventoryMovement(input: CreateInventoryMovementInput): Promise<InventoryMovement> {
  try {
    return await db.transaction(async (tx) => {
      // First, verify the product exists
      const product = await tx.select()
        .from(productsTable)
        .where(eq(productsTable.id, input.product_id))
        .limit(1)
        .execute();

      if (product.length === 0) {
        throw new Error(`Product with ID ${input.product_id} not found`);
      }

      const currentStock = product[0].stock_quantity;

      // Calculate new stock quantity based on movement type
      let stockChange = 0;
      if (input.movement_type === 'in') {
        stockChange = input.quantity;
      } else if (input.movement_type === 'out') {
        stockChange = -Math.abs(input.quantity);
      } else if (input.movement_type === 'adjustment') {
        // For adjustments, quantity can be positive or negative
        stockChange = input.quantity;
      }

      const newStock = currentStock + stockChange;

      // Validate that 'out' movements don't result in negative stock
      if (newStock < 0) {
        throw new Error(`Insufficient stock. Current: ${currentStock}, Requested: ${Math.abs(stockChange)}, Available: ${currentStock}`);
      }

      // Create inventory movement record
      const movementResult = await tx.insert(inventoryMovementsTable)
        .values({
          product_id: input.product_id,
          movement_type: input.movement_type,
          quantity: input.quantity,
          reference_type: input.reference_type,
          reference_id: input.reference_id,
          notes: input.notes
        })
        .returning()
        .execute();

      // Update product stock quantity
      await tx.update(productsTable)
        .set({ 
          stock_quantity: newStock,
          updated_at: sql`NOW()`
        })
        .where(eq(productsTable.id, input.product_id))
        .execute();

      return movementResult[0];
    });
  } catch (error) {
    console.error('Inventory movement creation failed:', error);
    throw error;
  }
}

export async function adjustInventory(productId: number, quantity: number, notes?: string): Promise<InventoryMovement> {
  try {
    const input: CreateInventoryMovementInput = {
      product_id: productId,
      movement_type: 'adjustment',
      quantity: quantity,
      reference_type: 'manual',
      reference_id: null,
      notes: notes || null
    };

    return await createInventoryMovement(input);
  } catch (error) {
    console.error('Inventory adjustment failed:', error);
    throw error;
  }
}