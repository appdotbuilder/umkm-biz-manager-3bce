import { db } from '../db';
import { customersTable } from '../db/schema';
import { type UpdateCustomerInput, type Customer } from '../schema';
import { eq } from 'drizzle-orm';

export const updateCustomer = async (input: UpdateCustomerInput): Promise<Customer> => {
  try {
    // Check if customer exists
    const existingCustomer = await db.select()
      .from(customersTable)
      .where(eq(customersTable.id, input.id))
      .execute();

    if (existingCustomer.length === 0) {
      throw new Error('Customer not found');
    }

    // If email is being changed, check for uniqueness
    if (input.email !== undefined && input.email !== null) {
      const emailExists = await db.select()
        .from(customersTable)
        .where(eq(customersTable.email, input.email))
        .execute();

      // Check if email belongs to a different customer
      if (emailExists.length > 0 && emailExists[0].id !== input.id) {
        throw new Error('Email already exists');
      }
    }

    // Build update object with only defined fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.email !== undefined) {
      updateData.email = input.email;
    }
    if (input.phone !== undefined) {
      updateData.phone = input.phone;
    }
    if (input.address !== undefined) {
      updateData.address = input.address;
    }

    // Update customer record
    const result = await db.update(customersTable)
      .set(updateData)
      .where(eq(customersTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Customer update failed:', error);
    throw error;
  }
};