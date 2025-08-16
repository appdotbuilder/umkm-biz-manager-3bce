import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { customersTable } from '../db/schema';
import { type CreateCustomerInput } from '../schema';
import { createCustomer } from '../handlers/create_customer';
import { eq } from 'drizzle-orm';

// Test input with all fields
const testInput: CreateCustomerInput = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  phone: '+1-555-0123',
  address: '123 Main St, Anytown, USA'
};

// Test input with minimal required fields
const minimalInput: CreateCustomerInput = {
  name: 'Jane Smith',
  email: null,
  phone: null,
  address: null
};

describe('createCustomer', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a customer with all fields', async () => {
    const result = await createCustomer(testInput);

    // Basic field validation
    expect(result.name).toEqual('John Doe');
    expect(result.email).toEqual('john.doe@example.com');
    expect(result.phone).toEqual('+1-555-0123');
    expect(result.address).toEqual('123 Main St, Anytown, USA');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a customer with minimal fields', async () => {
    const result = await createCustomer(minimalInput);

    expect(result.name).toEqual('Jane Smith');
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.address).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save customer to database', async () => {
    const result = await createCustomer(testInput);

    // Query using proper drizzle syntax
    const customers = await db.select()
      .from(customersTable)
      .where(eq(customersTable.id, result.id))
      .execute();

    expect(customers).toHaveLength(1);
    expect(customers[0].name).toEqual('John Doe');
    expect(customers[0].email).toEqual('john.doe@example.com');
    expect(customers[0].phone).toEqual('+1-555-0123');
    expect(customers[0].address).toEqual('123 Main St, Anytown, USA');
    expect(customers[0].created_at).toBeInstanceOf(Date);
    expect(customers[0].updated_at).toBeInstanceOf(Date);
  });

  it('should allow multiple customers with null emails', async () => {
    const input1: CreateCustomerInput = {
      name: 'Customer One',
      email: null,
      phone: null,
      address: null
    };

    const input2: CreateCustomerInput = {
      name: 'Customer Two',
      email: null,
      phone: null,
      address: null
    };

    const result1 = await createCustomer(input1);
    const result2 = await createCustomer(input2);

    expect(result1.id).toBeDefined();
    expect(result2.id).toBeDefined();
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.name).toEqual('Customer One');
    expect(result2.name).toEqual('Customer Two');
  });

  it('should reject duplicate emails', async () => {
    // Create first customer
    await createCustomer(testInput);

    // Try to create second customer with same email
    const duplicateInput: CreateCustomerInput = {
      name: 'Duplicate Customer',
      email: 'john.doe@example.com',
      phone: '+1-555-9999',
      address: '456 Other St'
    };

    await expect(createCustomer(duplicateInput))
      .rejects.toThrow(/already exists/i);
  });

  it('should allow customers with no email to be created alongside customers with emails', async () => {
    // Create customer with email
    const result1 = await createCustomer(testInput);

    // Create customer without email
    const result2 = await createCustomer(minimalInput);

    expect(result1.email).toEqual('john.doe@example.com');
    expect(result2.email).toBeNull();
    expect(result1.id).not.toEqual(result2.id);
  });

  it('should handle empty strings as null for optional fields', async () => {
    const inputWithEmptyStrings: CreateCustomerInput = {
      name: 'Test Customer',
      email: null,
      phone: null,
      address: null
    };

    const result = await createCustomer(inputWithEmptyStrings);

    expect(result.name).toEqual('Test Customer');
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.address).toBeNull();
  });
});