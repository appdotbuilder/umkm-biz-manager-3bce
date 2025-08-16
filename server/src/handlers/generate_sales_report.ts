import { db } from '../db';
import { transactionsTable, transactionItemsTable, productsTable } from '../db/schema';
import { type SalesReport, type ReportPeriod } from '../schema';
import { eq, and, gte, lte, sum, count, desc, SQL } from 'drizzle-orm';

export async function generateSalesReport(period: ReportPeriod): Promise<SalesReport> {
  try {
    // Parse dates - set start to beginning of day and end to end of day
    const startDate = new Date(period.start_date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(period.end_date);
    endDate.setHours(23, 59, 59, 999);

    // Build query conditions
    const conditions: SQL<unknown>[] = [
      eq(transactionsTable.status, 'completed'),
      gte(transactionsTable.created_at, startDate),
      lte(transactionsTable.created_at, endDate)
    ];

    // Get transaction summary
    const transactionSummary = await db.select({
      total_transactions: count(),
      total_revenue: sum(transactionsTable.final_amount),
      total_discount: sum(transactionsTable.discount_amount)
    })
    .from(transactionsTable)
    .where(and(...conditions))
    .execute();

    const summary = transactionSummary[0];

    // Get top-selling products
    const topProductsQuery = db.select({
      product_id: transactionItemsTable.product_id,
      product_name: productsTable.name,
      quantity_sold: sum(transactionItemsTable.quantity),
      revenue: sum(transactionItemsTable.total_price)
    })
    .from(transactionItemsTable)
    .innerJoin(transactionsTable, eq(transactionItemsTable.transaction_id, transactionsTable.id))
    .innerJoin(productsTable, eq(transactionItemsTable.product_id, productsTable.id))
    .where(and(...conditions))
    .groupBy(transactionItemsTable.product_id, productsTable.name)
    .orderBy(desc(sum(transactionItemsTable.quantity)))
    .limit(10);

    const topProducts = await topProductsQuery.execute();

    return {
      period: `${period.start_date} to ${period.end_date}`,
      total_transactions: summary.total_transactions || 0,
      total_revenue: parseFloat(summary.total_revenue || '0'),
      total_discount: parseFloat(summary.total_discount || '0'),
      top_products: topProducts.map(product => ({
        product_id: product.product_id,
        product_name: product.product_name,
        quantity_sold: parseInt(product.quantity_sold || '0'),
        revenue: parseFloat(product.revenue || '0')
      }))
    };
  } catch (error) {
    console.error('Sales report generation failed:', error);
    throw error;
  }
}

export async function getDailySalesReport(date: string): Promise<SalesReport> {
  try {
    // Create start and end of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const period: ReportPeriod = {
      start_date: startOfDay.toISOString().split('T')[0],
      end_date: endOfDay.toISOString().split('T')[0]
    };

    const report = await generateSalesReport(period);
    
    return {
      ...report,
      period: `Daily - ${date}`
    };
  } catch (error) {
    console.error('Daily sales report generation failed:', error);
    throw error;
  }
}

export async function getMonthlySalesReport(year: number, month: number): Promise<SalesReport> {
  try {
    // Create start and end of month
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0); // Last day of the month

    const period: ReportPeriod = {
      start_date: startOfMonth.toISOString().split('T')[0],
      end_date: endOfMonth.toISOString().split('T')[0]
    };

    const report = await generateSalesReport(period);
    
    return {
      ...report,
      period: `Monthly - ${year}/${month.toString().padStart(2, '0')}`
    };
  } catch (error) {
    console.error('Monthly sales report generation failed:', error);
    throw error;
  }
}