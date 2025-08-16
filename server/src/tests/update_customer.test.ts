import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { customersTable } from '../db/schema';
import { type CreateCustomerInput, type UpdateCustomerInput } from '../schema';
import { updateCustomer } from '../handlers/update_customer';
import { eq } from 'drizzle-orm';

// Helper to create a test customer
const createTestCustomer = async (customerData: CreateCustomerInput) => {
  const result = await db.insert(customersTable)
    .values({
      name: customerData.name,
      email: customerData.email,
      phone: customerData.phone,
      address: customerData.address
    })
    .returning()
    .execute();
  
  return result[0];
};

// Test data
const testCustomer: CreateCustomerInput = {
  name: 'John Doe',
  email: 'john@example.com',
  phone: '555-1234',
  address: '123 Main St'
};

const testCustomer2: CreateCustomerInput = {
  name: 'Jane Smith',
  email: 'jane@example.com',
  phone: '555-5678',
  address: '456 Oak Ave'
};

describe('updateCustomer', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update customer name', async () => {
    const customer = await createTestCustomer(testCustomer);
    
    const updateInput: UpdateCustomerInput = {
      id: customer.id,
      name: 'John Updated'
    };

    const result = await updateCustomer(updateInput);

    expect(result.id).toEqual(customer.id);
    expect(result.name).toEqual('John Updated');
    expect(result.email).toEqual(testCustomer.email);
    expect(result.phone).toEqual(testCustomer.phone);
    expect(result.address).toEqual(testCustomer.address);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > customer.updated_at).toBe(true);
  });

  it('should update customer email', async () => {
    const customer = await createTestCustomer(testCustomer);
    
    const updateInput: UpdateCustomerInput = {
      id: customer.id,
      email: 'newemail@example.com'
    };

    const result = await updateCustomer(updateInput);

    expect(result.email).toEqual('newemail@example.com');
    expect(result.name).toEqual(testCustomer.name);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update customer phone', async () => {
    const customer = await createTestCustomer(testCustomer);
    
    const updateInput: UpdateCustomerInput = {
      id: customer.id,
      phone: '555-9999'
    };

    const result = await updateCustomer(updateInput);

    expect(result.phone).toEqual('555-9999');
    expect(result.name).toEqual(testCustomer.name);
    expect(result.email).toEqual(testCustomer.email);
  });

  it('should update customer address', async () => {
    const customer = await createTestCustomer(testCustomer);
    
    const updateInput: UpdateCustomerInput = {
      id: customer.id,
      address: '789 New Street'
    };

    const result = await updateCustomer(updateInput);

    expect(result.address).toEqual('789 New Street');
    expect(result.name).toEqual(testCustomer.name);
    expect(result.email).toEqual(testCustomer.email);
  });

  it('should update multiple fields at once', async () => {
    const customer = await createTestCustomer(testCustomer);
    
    const updateInput: UpdateCustomerInput = {
      id: customer.id,
      name: 'John Updated',
      email: 'johnupdated@example.com',
      phone: '555-0000',
      address: '999 Updated Ave'
    };

    const result = await updateCustomer(updateInput);

    expect(result.id).toEqual(customer.id);
    expect(result.name).toEqual('John Updated');
    expect(result.email).toEqual('johnupdated@example.com');
    expect(result.phone).toEqual('555-0000');
    expect(result.address).toEqual('999 Updated Ave');
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > customer.updated_at).toBe(true);
  });

  it('should handle null values correctly', async () => {
    const customer = await createTestCustomer(testCustomer);
    
    const updateInput: UpdateCustomerInput = {
      id: customer.id,
      email: null,
      phone: null,
      address: null
    };

    const result = await updateCustomer(updateInput);

    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.address).toBeNull();
    expect(result.name).toEqual(testCustomer.name);
  });

  it('should save changes to database', async () => {
    const customer = await createTestCustomer(testCustomer);
    
    const updateInput: UpdateCustomerInput = {
      id: customer.id,
      name: 'Database Test',
      email: 'dbtest@example.com'
    };

    await updateCustomer(updateInput);

    // Verify changes were saved
    const savedCustomer = await db.select()
      .from(customersTable)
      .where(eq(customersTable.id, customer.id))
      .execute();

    expect(savedCustomer).toHaveLength(1);
    expect(savedCustomer[0].name).toEqual('Database Test');
    expect(savedCustomer[0].email).toEqual('dbtest@example.com');
    expect(savedCustomer[0].updated_at).toBeInstanceOf(Date);
    expect(savedCustomer[0].updated_at > customer.updated_at).toBe(true);
  });

  it('should throw error when customer does not exist', async () => {
    const updateInput: UpdateCustomerInput = {
      id: 999999,
      name: 'Non-existent'
    };

    await expect(updateCustomer(updateInput)).rejects.toThrow(/customer not found/i);
  });

  it('should throw error when email already exists for different customer', async () => {
    const customer1 = await createTestCustomer(testCustomer);
    const customer2 = await createTestCustomer(testCustomer2);
    
    const updateInput: UpdateCustomerInput = {
      id: customer2.id,
      email: testCustomer.email // Try to use customer1's email
    };

    await expect(updateCustomer(updateInput)).rejects.toThrow(/email already exists/i);
  });

  it('should allow updating to same email', async () => {
    const customer = await createTestCustomer(testCustomer);
    
    const updateInput: UpdateCustomerInput = {
      id: customer.id,
      name: 'Updated Name',
      email: testCustomer.email // Same email
    };

    const result = await updateCustomer(updateInput);

    expect(result.name).toEqual('Updated Name');
    expect(result.email).toEqual(testCustomer.email);
  });

  it('should update only updated_at when no other fields provided', async () => {
    const customer = await createTestCustomer(testCustomer);
    const originalUpdatedAt = customer.updated_at;
    
    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 1));
    
    const updateInput: UpdateCustomerInput = {
      id: customer.id
    };

    const result = await updateCustomer(updateInput);

    expect(result.name).toEqual(testCustomer.name);
    expect(result.email).toEqual(testCustomer.email);
    expect(result.phone).toEqual(testCustomer.phone);
    expect(result.address).toEqual(testCustomer.address);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > originalUpdatedAt).toBe(true);
  });
});