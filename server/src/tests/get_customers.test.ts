import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { customersTable, usersTable, productsTable, transactionsTable, transactionItemsTable } from '../db/schema';
import { type CreateCustomerInput, type CreateUserInput, type CreateProductInput } from '../schema';
import { getCustomers, getCustomerById, getCustomerPurchaseHistory, type GetCustomersFilters } from '../handlers/get_customers';
import { eq } from 'drizzle-orm';

// Test data
const testCustomer: CreateCustomerInput = {
  name: 'John Doe',
  email: 'john.doe@email.com',
  phone: '+1234567890',
  address: '123 Main St, Anytown USA'
};

const testCustomer2: CreateCustomerInput = {
  name: 'Jane Smith',
  email: 'jane.smith@email.com',
  phone: '+0987654321',
  address: '456 Oak Ave, Another City'
};

const testUser: CreateUserInput = {
  username: 'testemployee',
  email: 'employee@test.com',
  password: 'password123',
  role: 'employee'
};

const testProduct: CreateProductInput = {
  name: 'Test Product',
  description: 'A test product',
  price: 29.99,
  stock_quantity: 100,
  min_stock_level: 10,
  category: 'Test Category',
  sku: 'TEST-001'
};

describe('getCustomers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no customers exist', async () => {
    const result = await getCustomers();
    
    expect(result).toEqual([]);
  });

  it('should return all customers', async () => {
    // Create test customers
    const customer1 = await db.insert(customersTable)
      .values({
        name: testCustomer.name,
        email: testCustomer.email,
        phone: testCustomer.phone,
        address: testCustomer.address
      })
      .returning()
      .execute();

    const customer2 = await db.insert(customersTable)
      .values({
        name: testCustomer2.name,
        email: testCustomer2.email,
        phone: testCustomer2.phone,
        address: testCustomer2.address
      })
      .returning()
      .execute();

    const result = await getCustomers();

    expect(result).toHaveLength(2);
    expect(result[0].name).toEqual('Jane Smith'); // Should be ordered by created_at desc
    expect(result[1].name).toEqual('John Doe');
  });

  it('should filter customers by name search', async () => {
    // Create test customers
    await db.insert(customersTable)
      .values({
        name: testCustomer.name,
        email: testCustomer.email,
        phone: testCustomer.phone,
        address: testCustomer.address
      })
      .execute();

    await db.insert(customersTable)
      .values({
        name: testCustomer2.name,
        email: testCustomer2.email,
        phone: testCustomer2.phone,
        address: testCustomer2.address
      })
      .execute();

    const filters: GetCustomersFilters = {
      search: 'Jane'
    };

    const result = await getCustomers(filters);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Jane Smith');
  });

  it('should filter customers by email search', async () => {
    await db.insert(customersTable)
      .values({
        name: testCustomer.name,
        email: testCustomer.email,
        phone: testCustomer.phone,
        address: testCustomer.address
      })
      .execute();

    const filters: GetCustomersFilters = {
      search: 'john.doe'
    };

    const result = await getCustomers(filters);

    expect(result).toHaveLength(1);
    expect(result[0].email).toEqual('john.doe@email.com');
  });

  it('should filter customers by phone search', async () => {
    await db.insert(customersTable)
      .values({
        name: testCustomer.name,
        email: testCustomer.email,
        phone: testCustomer.phone,
        address: testCustomer.address
      })
      .execute();

    const filters: GetCustomersFilters = {
      search: '1234567890'
    };

    const result = await getCustomers(filters);

    expect(result).toHaveLength(1);
    expect(result[0].phone).toEqual('+1234567890');
  });

  it('should apply pagination', async () => {
    // Create multiple customers
    for (let i = 0; i < 5; i++) {
      await db.insert(customersTable)
        .values({
          name: `Customer ${i}`,
          email: `customer${i}@test.com`,
          phone: `+123456789${i}`,
          address: `${i} Test St`
        })
        .execute();
    }

    const filters: GetCustomersFilters = {
      limit: 2,
      offset: 1
    };

    const result = await getCustomers(filters);

    expect(result).toHaveLength(2);
    // Should skip the first customer and return the next 2
  });

  it('should return empty array when search yields no results', async () => {
    await db.insert(customersTable)
      .values({
        name: testCustomer.name,
        email: testCustomer.email,
        phone: testCustomer.phone,
        address: testCustomer.address
      })
      .execute();

    const filters: GetCustomersFilters = {
      search: 'nonexistent'
    };

    const result = await getCustomers(filters);

    expect(result).toEqual([]);
  });
});

describe('getCustomerById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return customer by ID', async () => {
    const customer = await db.insert(customersTable)
      .values({
        name: testCustomer.name,
        email: testCustomer.email,
        phone: testCustomer.phone,
        address: testCustomer.address
      })
      .returning()
      .execute();

    const result = await getCustomerById(customer[0].id);

    expect(result).toBeDefined();
    expect(result!.id).toEqual(customer[0].id);
    expect(result!.name).toEqual('John Doe');
    expect(result!.email).toEqual('john.doe@email.com');
    expect(result!.phone).toEqual('+1234567890');
    expect(result!.address).toEqual('123 Main St, Anytown USA');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null when customer does not exist', async () => {
    const result = await getCustomerById(999);

    expect(result).toBeNull();
  });
});

describe('getCustomerPurchaseHistory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when customer has no purchases', async () => {
    const customer = await db.insert(customersTable)
      .values({
        name: testCustomer.name,
        email: testCustomer.email,
        phone: testCustomer.phone,
        address: testCustomer.address
      })
      .returning()
      .execute();

    const result = await getCustomerPurchaseHistory(customer[0].id);

    expect(result).toEqual([]);
  });

  it('should return customer purchase history with transaction items', async () => {
    // Create prerequisite data
    const customer = await db.insert(customersTable)
      .values({
        name: testCustomer.name,
        email: testCustomer.email,
        phone: testCustomer.phone,
        address: testCustomer.address
      })
      .returning()
      .execute();

    const user = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        password_hash: 'hashed_password',
        role: testUser.role
      })
      .returning()
      .execute();

    const product = await db.insert(productsTable)
      .values({
        name: testProduct.name,
        description: testProduct.description,
        price: testProduct.price.toString(),
        stock_quantity: testProduct.stock_quantity,
        min_stock_level: testProduct.min_stock_level,
        category: testProduct.category,
        sku: testProduct.sku
      })
      .returning()
      .execute();

    // Create transaction
    const transaction = await db.insert(transactionsTable)
      .values({
        customer_id: customer[0].id,
        user_id: user[0].id,
        total_amount: '59.98',
        discount_amount: '5.00',
        final_amount: '54.98',
        status: 'completed',
        payment_method: 'credit_card'
      })
      .returning()
      .execute();

    // Create transaction items
    await db.insert(transactionItemsTable)
      .values({
        transaction_id: transaction[0].id,
        product_id: product[0].id,
        quantity: 2,
        unit_price: '29.99',
        total_price: '59.98'
      })
      .execute();

    const result = await getCustomerPurchaseHistory(customer[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(transaction[0].id);
    expect(result[0].total_amount).toEqual(59.98);
    expect(result[0].discount_amount).toEqual(5.00);
    expect(result[0].final_amount).toEqual(54.98);
    expect(result[0].status).toEqual('completed');
    expect(result[0].payment_method).toEqual('credit_card');
    expect(result[0].created_at).toBeInstanceOf(Date);

    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].product_name).toEqual('Test Product');
    expect(result[0].items[0].quantity).toEqual(2);
    expect(result[0].items[0].unit_price).toEqual(29.99);
    expect(result[0].items[0].total_price).toEqual(59.98);
  });

  it('should return multiple transactions ordered by date', async () => {
    // Create prerequisite data
    const customer = await db.insert(customersTable)
      .values({
        name: testCustomer.name,
        email: testCustomer.email,
        phone: testCustomer.phone,
        address: testCustomer.address
      })
      .returning()
      .execute();

    const user = await db.insert(usersTable)
      .values({
        username: testUser.username,
        email: testUser.email,
        password_hash: 'hashed_password',
        role: testUser.role
      })
      .returning()
      .execute();

    const product = await db.insert(productsTable)
      .values({
        name: testProduct.name,
        description: testProduct.description,
        price: testProduct.price.toString(),
        stock_quantity: testProduct.stock_quantity,
        min_stock_level: testProduct.min_stock_level,
        category: testProduct.category,
        sku: testProduct.sku
      })
      .returning()
      .execute();

    // Create two transactions
    const transaction1 = await db.insert(transactionsTable)
      .values({
        customer_id: customer[0].id,
        user_id: user[0].id,
        total_amount: '29.99',
        discount_amount: '0.00',
        final_amount: '29.99',
        status: 'completed',
        payment_method: 'cash'
      })
      .returning()
      .execute();

    const transaction2 = await db.insert(transactionsTable)
      .values({
        customer_id: customer[0].id,
        user_id: user[0].id,
        total_amount: '59.98',
        discount_amount: '5.00',
        final_amount: '54.98',
        status: 'completed',
        payment_method: 'credit_card'
      })
      .returning()
      .execute();

    // Create items for both transactions
    await db.insert(transactionItemsTable)
      .values({
        transaction_id: transaction1[0].id,
        product_id: product[0].id,
        quantity: 1,
        unit_price: '29.99',
        total_price: '29.99'
      })
      .execute();

    await db.insert(transactionItemsTable)
      .values({
        transaction_id: transaction2[0].id,
        product_id: product[0].id,
        quantity: 2,
        unit_price: '29.99',
        total_price: '59.98'
      })
      .execute();

    const result = await getCustomerPurchaseHistory(customer[0].id);

    expect(result).toHaveLength(2);
    // Should be ordered by created_at desc (most recent first)
    expect(result[0].final_amount).toEqual(54.98); // Second transaction
    expect(result[1].final_amount).toEqual(29.99); // First transaction
  });

  it('should return empty array for non-existent customer', async () => {
    const result = await getCustomerPurchaseHistory(999);

    expect(result).toEqual([]);
  });
});