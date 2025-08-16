import { db } from '../db';
import { customersTable } from '../db/schema';
import { type CreateCustomerInput, type Customer } from '../schema';
import { eq } from 'drizzle-orm';

export const createCustomer = async (input: CreateCustomerInput): Promise<Customer> => {
  try {
    // Validate email uniqueness if provided
    if (input.email) {
      const existingCustomer = await db.select()
        .from(customersTable)
        .where(eq(customersTable.email, input.email))
        .execute();

      if (existingCustomer.length > 0) {
        throw new Error(`Customer with email ${input.email} already exists`);
      }
    }

    // Insert customer record
    const result = await db.insert(customersTable)
      .values({
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Customer creation failed:', error);
    throw error;
  }
};