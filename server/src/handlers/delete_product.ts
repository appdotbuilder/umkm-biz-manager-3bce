import { db } from '../db';
import { productsTable, transactionItemsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function deleteProduct(id: number): Promise<{ success: boolean }> {
  try {
    // First, check if the product exists
    const existingProducts = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, id))
      .execute();

    if (existingProducts.length === 0) {
      throw new Error(`Product with id ${id} not found`);
    }

    const product = existingProducts[0];

    // Check if product is already inactive
    if (!product.is_active) {
      return { success: true }; // Already soft-deleted
    }

    // Check if product has any transaction history
    const transactionHistory = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.product_id, id))
      .limit(1)
      .execute();

    // If product has transaction history, only soft delete (set is_active to false)
    // Otherwise, we still soft delete to maintain data integrity
    await db.update(productsTable)
      .set({ 
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(productsTable.id, id))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Product deletion failed:', error);
    throw error;
  }
}