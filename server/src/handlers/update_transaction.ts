import { db } from '../db';
import { transactionsTable, transactionItemsTable, productsTable, inventoryMovementsTable } from '../db/schema';
import { type UpdateTransactionInput, type Transaction } from '../schema';
import { eq, sql } from 'drizzle-orm';

export const updateTransaction = async (input: UpdateTransactionInput): Promise<Transaction> => {
  try {
    // First, get the current transaction to check status changes
    const currentTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, input.id))
      .execute();

    if (currentTransaction.length === 0) {
      throw new Error(`Transaction with id ${input.id} not found`);
    }

    const current = currentTransaction[0];
    const currentStatus = current.status;
    const newStatus = input.status || currentStatus;

    // Handle inventory adjustments if status is changing
    if (input.status && input.status !== currentStatus) {
      await handleStatusChange(input.id, currentStatus, newStatus);
    }

    // Calculate final_amount if total_amount or discount_amount is being updated
    let final_amount = parseFloat(current.final_amount);
    if (input.total_amount !== undefined || input.discount_amount !== undefined) {
      const total = input.total_amount !== undefined 
        ? input.total_amount 
        : parseFloat(current.total_amount);
      const discount = input.discount_amount !== undefined 
        ? input.discount_amount 
        : parseFloat(current.discount_amount);
      final_amount = total - discount;
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: sql`NOW()`
    };

    if (input.customer_id !== undefined) {
      updateData.customer_id = input.customer_id;
    }
    if (input.total_amount !== undefined) {
      updateData.total_amount = input.total_amount.toString();
    }
    if (input.discount_amount !== undefined) {
      updateData.discount_amount = input.discount_amount.toString();
    }
    if (input.status !== undefined) {
      updateData.status = input.status;
    }
    if (input.payment_method !== undefined) {
      updateData.payment_method = input.payment_method;
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    // Always update final_amount if amounts changed
    if (input.total_amount !== undefined || input.discount_amount !== undefined) {
      updateData.final_amount = final_amount.toString();
    }

    // Update the transaction
    const result = await db.update(transactionsTable)
      .set(updateData)
      .where(eq(transactionsTable.id, input.id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers
    const transaction = result[0];
    return {
      ...transaction,
      total_amount: parseFloat(transaction.total_amount),
      discount_amount: parseFloat(transaction.discount_amount),
      final_amount: parseFloat(transaction.final_amount)
    };
  } catch (error) {
    console.error('Transaction update failed:', error);
    throw error;
  }
};

// Helper function to handle inventory adjustments on status changes
async function handleStatusChange(transactionId: number, currentStatus: string, newStatus: string): Promise<void> {
  // Only handle inventory if transitioning from/to completed status
  if (currentStatus === newStatus) return;

  // Get transaction items for inventory adjustments
  const items = await db.select()
    .from(transactionItemsTable)
    .where(eq(transactionItemsTable.transaction_id, transactionId))
    .execute();

  if (items.length === 0) return;

  // If changing from completed to cancelled, restore inventory
  if (currentStatus === 'completed' && newStatus === 'cancelled') {
    for (const item of items) {
      // Restore product stock
      await db.update(productsTable)
        .set({
          stock_quantity: sql`${productsTable.stock_quantity} + ${item.quantity}`,
          updated_at: sql`NOW()`
        })
        .where(eq(productsTable.id, item.product_id))
        .execute();

      // Record inventory movement
      await db.insert(inventoryMovementsTable)
        .values({
          product_id: item.product_id,
          movement_type: 'in',
          quantity: item.quantity,
          reference_type: 'transaction_cancellation',
          reference_id: transactionId,
          notes: `Stock restored from cancelled transaction ${transactionId}`
        })
        .execute();
    }
  }
  
  // If changing from cancelled to completed, reduce inventory
  if (currentStatus === 'cancelled' && newStatus === 'completed') {
    for (const item of items) {
      // Check if we have enough stock
      const product = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, item.product_id))
        .execute();

      if (product.length === 0) {
        throw new Error(`Product with id ${item.product_id} not found`);
      }

      if (product[0].stock_quantity < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.product_id}. Available: ${product[0].stock_quantity}, Required: ${item.quantity}`);
      }

      // Reduce product stock
      await db.update(productsTable)
        .set({
          stock_quantity: sql`${productsTable.stock_quantity} - ${item.quantity}`,
          updated_at: sql`NOW()`
        })
        .where(eq(productsTable.id, item.product_id))
        .execute();

      // Record inventory movement
      await db.insert(inventoryMovementsTable)
        .values({
          product_id: item.product_id,
          movement_type: 'out',
          quantity: item.quantity,
          reference_type: 'transaction_completion',
          reference_id: transactionId,
          notes: `Stock reduced for completed transaction ${transactionId}`
        })
        .execute();
    }
  }
}