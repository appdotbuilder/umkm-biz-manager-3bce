import { db } from '../db';
import { transactionsTable, transactionItemsTable, productsTable, inventoryMovementsTable } from '../db/schema';
import { type CreateTransactionInput, type Transaction } from '../schema';
import { eq, SQL } from 'drizzle-orm';

export const createTransaction = async (input: CreateTransactionInput): Promise<Transaction> => {
  try {
    return await db.transaction(async (tx) => {
      // Calculate final amount
      const finalAmount = input.total_amount - input.discount_amount;
      
      // 1. Create transaction record
      const transactionResult = await tx.insert(transactionsTable)
        .values({
          customer_id: input.customer_id,
          user_id: input.user_id,
          total_amount: input.total_amount.toString(),
          discount_amount: input.discount_amount.toString(),
          final_amount: finalAmount.toString(),
          status: 'completed',
          payment_method: input.payment_method,
          notes: input.notes
        })
        .returning()
        .execute();

      const transaction = transactionResult[0];

      // 2. Create transaction items and update inventory
      for (const item of input.items) {
        // Verify product exists and has sufficient stock
        const productQuery = await tx.select()
          .from(productsTable)
          .where(eq(productsTable.id, item.product_id))
          .execute();

        if (productQuery.length === 0) {
          throw new Error(`Product with ID ${item.product_id} not found`);
        }

        const product = productQuery[0];
        if (product.stock_quantity < item.quantity) {
          throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock_quantity}, Required: ${item.quantity}`);
        }

        // Calculate total price for this item
        const totalPrice = item.unit_price * item.quantity;

        // Create transaction item
        await tx.insert(transactionItemsTable)
          .values({
            transaction_id: transaction.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price.toString(),
            total_price: totalPrice.toString()
          })
          .execute();

        // 3. Update product stock quantity
        const newStockQuantity = product.stock_quantity - item.quantity;
        await tx.update(productsTable)
          .set({
            stock_quantity: newStockQuantity,
            updated_at: new Date()
          })
          .where(eq(productsTable.id, item.product_id))
          .execute();

        // 4. Create inventory movement record
        await tx.insert(inventoryMovementsTable)
          .values({
            product_id: item.product_id,
            movement_type: 'out',
            quantity: -item.quantity, // Negative for outbound movement
            reference_type: 'transaction',
            reference_id: transaction.id,
            notes: `Sale via transaction #${transaction.id}`
          })
          .execute();
      }

      // Convert numeric fields back to numbers before returning
      return {
        ...transaction,
        total_amount: parseFloat(transaction.total_amount),
        discount_amount: parseFloat(transaction.discount_amount),
        final_amount: parseFloat(transaction.final_amount)
      };
    });
  } catch (error) {
    console.error('Transaction creation failed:', error);
    throw error;
  }
};