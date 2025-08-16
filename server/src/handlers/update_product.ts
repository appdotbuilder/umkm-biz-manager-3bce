import { db } from '../db';
import { productsTable } from '../db/schema';
import { type UpdateProductInput, type Product } from '../schema';
import { eq, and, ne, sql } from 'drizzle-orm';

export const updateProduct = async (input: UpdateProductInput): Promise<Product> => {
  try {
    // Check if product exists
    const existingProduct = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, input.id))
      .execute();

    if (existingProduct.length === 0) {
      throw new Error(`Product with id ${input.id} not found`);
    }

    // If SKU is being updated, check for uniqueness
    if (input.sku !== undefined && input.sku !== null) {
      const existingSkuProduct = await db.select()
        .from(productsTable)
        .where(
          and(
            eq(productsTable.sku, input.sku),
            ne(productsTable.id, input.id)
          )
        )
        .execute();

      if (existingSkuProduct.length > 0) {
        throw new Error(`SKU '${input.sku}' already exists for another product`);
      }
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: sql`now()` // Use SQL function for precise timestamp
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.price !== undefined) updateData.price = input.price.toString();
    if (input.stock_quantity !== undefined) updateData.stock_quantity = input.stock_quantity;
    if (input.min_stock_level !== undefined) updateData.min_stock_level = input.min_stock_level;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.sku !== undefined) updateData.sku = input.sku;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    // Update the product
    const result = await db.update(productsTable)
      .set(updateData)
      .where(eq(productsTable.id, input.id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const product = result[0];
    return {
      ...product,
      price: parseFloat(product.price)
    };
  } catch (error) {
    console.error('Product update failed:', error);
    throw error;
  }
};