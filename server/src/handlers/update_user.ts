import { db } from '../db';
import { usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type UpdateUserInput, type User } from '../schema';

export const updateUser = async (input: UpdateUserInput): Promise<User> => {
  try {
    // First, check if the user exists
    const existingUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.id))
      .execute();

    if (existingUsers.length === 0) {
      throw new Error(`User with id ${input.id} not found`);
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date()
    };

    // Only include fields that are provided in the input
    if (input.username !== undefined) {
      updateData.username = input.username;
    }
    
    if (input.email !== undefined) {
      updateData.email = input.email;
    }
    
    if (input.password !== undefined) {
      // Hash the password using Bun's built-in password hashing
      updateData.password_hash = await Bun.password.hash(input.password);
    }
    
    if (input.role !== undefined) {
      updateData.role = input.role;
    }
    
    if (input.is_active !== undefined) {
      updateData.is_active = input.is_active;
    }

    // Update the user record
    const result = await db.update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User update failed:', error);
    throw error;
  }
};