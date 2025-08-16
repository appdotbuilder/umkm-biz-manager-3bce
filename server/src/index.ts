import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Schema imports
import {
  createUserInputSchema,
  updateUserInputSchema,
  loginInputSchema,
  createProductInputSchema,
  updateProductInputSchema,
  createCustomerInputSchema,
  updateCustomerInputSchema,
  createTransactionInputSchema,
  updateTransactionInputSchema,
  createInventoryMovementInputSchema,
  reportPeriodSchema
} from './schema';

// Handler imports
// User handlers
import { createUser } from './handlers/create_user';
import { loginUser } from './handlers/login_user';
import { getUsers } from './handlers/get_users';
import { updateUser } from './handlers/update_user';

// Product handlers
import { createProduct } from './handlers/create_product';
import { getProducts, getProductById, getLowStockProducts } from './handlers/get_products';
import { updateProduct } from './handlers/update_product';
import { deleteProduct } from './handlers/delete_product';

// Customer handlers
import { createCustomer } from './handlers/create_customer';
import { getCustomers, getCustomerById, getCustomerPurchaseHistory } from './handlers/get_customers';
import { updateCustomer } from './handlers/update_customer';

// Transaction handlers
import { createTransaction } from './handlers/create_transaction';
import { getTransactions, getTransactionById, getTransactionsByDateRange } from './handlers/get_transactions';
import { updateTransaction } from './handlers/update_transaction';

// Inventory handlers
import { createInventoryMovement, adjustInventory } from './handlers/create_inventory_movement';
import { getInventoryMovements, getInventoryMovementsByProduct } from './handlers/get_inventory_movements';

// Report handlers
import { generateSalesReport, getDailySalesReport, getMonthlySalesReport } from './handlers/generate_sales_report';
import { generateInventoryReport, getStockAlerts } from './handlers/generate_inventory_report';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User authentication routes
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),
  
  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => loginUser(input)),
  
  getUsers: publicProcedure
    .query(() => getUsers()),
  
  updateUser: publicProcedure
    .input(updateUserInputSchema)
    .mutation(({ input }) => updateUser(input)),

  // Product management routes
  createProduct: publicProcedure
    .input(createProductInputSchema)
    .mutation(({ input }) => createProduct(input)),
  
  getProducts: publicProcedure
    .query(() => getProducts()),
  
  getProductById: publicProcedure
    .input(z.number())
    .query(({ input }) => getProductById(input)),
  
  getLowStockProducts: publicProcedure
    .query(() => getLowStockProducts()),
  
  updateProduct: publicProcedure
    .input(updateProductInputSchema)
    .mutation(({ input }) => updateProduct(input)),
  
  deleteProduct: publicProcedure
    .input(z.number())
    .mutation(({ input }) => deleteProduct(input)),

  // Customer management routes
  createCustomer: publicProcedure
    .input(createCustomerInputSchema)
    .mutation(({ input }) => createCustomer(input)),
  
  getCustomers: publicProcedure
    .query(() => getCustomers()),
  
  getCustomerById: publicProcedure
    .input(z.number())
    .query(({ input }) => getCustomerById(input)),
  
  getCustomerPurchaseHistory: publicProcedure
    .input(z.number())
    .query(({ input }) => getCustomerPurchaseHistory(input)),
  
  updateCustomer: publicProcedure
    .input(updateCustomerInputSchema)
    .mutation(({ input }) => updateCustomer(input)),

  // Transaction/Sales routes
  createTransaction: publicProcedure
    .input(createTransactionInputSchema)
    .mutation(({ input }) => createTransaction(input)),
  
  getTransactions: publicProcedure
    .query(() => getTransactions()),
  
  getTransactionById: publicProcedure
    .input(z.number())
    .query(({ input }) => getTransactionById(input)),
  
  getTransactionsByDateRange: publicProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string()
    }))
    .query(({ input }) => getTransactionsByDateRange(input.startDate, input.endDate)),
  
  updateTransaction: publicProcedure
    .input(updateTransactionInputSchema)
    .mutation(({ input }) => updateTransaction(input)),

  // Inventory management routes
  createInventoryMovement: publicProcedure
    .input(createInventoryMovementInputSchema)
    .mutation(({ input }) => createInventoryMovement(input)),
  
  adjustInventory: publicProcedure
    .input(z.object({
      productId: z.number(),
      quantity: z.number().int(),
      notes: z.string().optional()
    }))
    .mutation(({ input }) => adjustInventory(input.productId, input.quantity, input.notes)),
  
  getInventoryMovements: publicProcedure
    .query(() => getInventoryMovements()),
  
  getInventoryMovementsByProduct: publicProcedure
    .input(z.number())
    .query(({ input }) => getInventoryMovementsByProduct(input)),

  // Reporting routes
  generateSalesReport: publicProcedure
    .input(reportPeriodSchema)
    .query(({ input }) => generateSalesReport(input)),
  
  getDailySalesReport: publicProcedure
    .input(z.string())
    .query(({ input }) => getDailySalesReport(input)),
  
  getMonthlySalesReport: publicProcedure
    .input(z.object({
      year: z.number().int(),
      month: z.number().int().min(1).max(12)
    }))
    .query(({ input }) => getMonthlySalesReport(input.year, input.month)),
  
  generateInventoryReport: publicProcedure
    .query(() => generateInventoryReport()),
  
  getStockAlerts: publicProcedure
    .query(() => getStockAlerts()),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();