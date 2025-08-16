import { db } from '../db';
import { productsTable } from '../db/schema';
import { type InventoryReport } from '../schema';
import { eq, lte, sql } from 'drizzle-orm';

export async function generateInventoryReport(): Promise<InventoryReport> {
  try {
    // Get all active products
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.is_active, true))
      .execute();

    // Calculate metrics
    const totalProducts = products.length;
    
    // Low stock products (stock_quantity <= min_stock_level AND > 0)
    const lowStockProducts = products
      .filter(product => 
        product.stock_quantity <= product.min_stock_level && 
        product.stock_quantity > 0
      )
      .map(product => ({
        product_id: product.id,
        product_name: product.name,
        current_stock: product.stock_quantity,
        min_stock_level: product.min_stock_level
      }));

    // Out of stock products (stock_quantity = 0)
    const outOfStockProducts = products
      .filter(product => product.stock_quantity === 0)
      .map(product => ({
        product_id: product.id,
        product_name: product.name
      }));

    // Calculate total inventory value (stock * price for all products)
    const totalInventoryValue = products.reduce((total, product) => {
      const price = parseFloat(product.price);
      return total + (product.stock_quantity * price);
    }, 0);

    return {
      total_products: totalProducts,
      low_stock_products: lowStockProducts,
      out_of_stock_products: outOfStockProducts,
      total_inventory_value: totalInventoryValue
    };
  } catch (error) {
    console.error('Inventory report generation failed:', error);
    throw error;
  }
}

export async function getStockAlerts(): Promise<{ low_stock: any[], out_of_stock: any[] }> {
  try {
    // Get products with stock alerts - only active products
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.is_active, true))
      .execute();

    // Filter for low stock (stock <= min_stock AND > 0)
    const lowStock = products
      .filter(product => 
        product.stock_quantity <= product.min_stock_level && 
        product.stock_quantity > 0
      )
      .map(product => ({
        id: product.id,
        name: product.name,
        current_stock: product.stock_quantity,
        min_stock_level: product.min_stock_level,
        price: parseFloat(product.price),
        category: product.category,
        sku: product.sku
      }));

    // Filter for out of stock (stock = 0)
    const outOfStock = products
      .filter(product => product.stock_quantity === 0)
      .map(product => ({
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        category: product.category,
        sku: product.sku,
        min_stock_level: product.min_stock_level
      }));

    return {
      low_stock: lowStock,
      out_of_stock: outOfStock
    };
  } catch (error) {
    console.error('Stock alerts retrieval failed:', error);
    throw error;
  }
}