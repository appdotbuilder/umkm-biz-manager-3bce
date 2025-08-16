import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type UpdateUserInput, type CreateUserInput } from '../schema';
import { updateUser } from '../handlers/update_user';
import { eq } from 'drizzle-orm';

// Helper function to create a test user
const createTestUser = async (): Promise<number> => {
  const hashedPassword = await Bun.password.hash('testpassword123');
  
  const result = await db.insert(usersTable)
    .values({
      username: 'testuser',
      email: 'test@example.com',
      password_hash: hashedPassword,
      role: 'employee',
      is_active: true
    })
    .returning()
    .execute();

  return result[0].id;
};

describe('updateUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update user username', async () => {
    const userId = await createTestUser();

    const updateInput: UpdateUserInput = {
      id: userId,
      username: 'updateduser'
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(userId);
    expect(result.username).toEqual('updateduser');
    expect(result.email).toEqual('test@example.com'); // Should remain unchanged
    expect(result.role).toEqual('employee'); // Should remain unchanged
    expect(result.is_active).toEqual(true); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update user email', async () => {
    const userId = await createTestUser();

    const updateInput: UpdateUserInput = {
      id: userId,
      email: 'newemail@example.com'
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(userId);
    expect(result.username).toEqual('testuser'); // Should remain unchanged
    expect(result.email).toEqual('newemail@example.com');
    expect(result.role).toEqual('employee'); // Should remain unchanged
    expect(result.is_active).toEqual(true); // Should remain unchanged
  });

  it('should update user password', async () => {
    const userId = await createTestUser();
    const originalUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    const updateInput: UpdateUserInput = {
      id: userId,
      password: 'newpassword456'
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(userId);
    expect(result.password_hash).not.toEqual(originalUser[0].password_hash);
    
    // Verify the new password hash is valid
    const isValidPassword = await Bun.password.verify('newpassword456', result.password_hash);
    expect(isValidPassword).toBe(true);
  });

  it('should update user role', async () => {
    const userId = await createTestUser();

    const updateInput: UpdateUserInput = {
      id: userId,
      role: 'admin'
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(userId);
    expect(result.role).toEqual('admin');
    expect(result.username).toEqual('testuser'); // Should remain unchanged
  });

  it('should update user active status', async () => {
    const userId = await createTestUser();

    const updateInput: UpdateUserInput = {
      id: userId,
      is_active: false
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(userId);
    expect(result.is_active).toEqual(false);
    expect(result.username).toEqual('testuser'); // Should remain unchanged
  });

  it('should update multiple fields at once', async () => {
    const userId = await createTestUser();

    const updateInput: UpdateUserInput = {
      id: userId,
      username: 'multifielduser',
      email: 'multifield@example.com',
      role: 'admin',
      is_active: false
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(userId);
    expect(result.username).toEqual('multifielduser');
    expect(result.email).toEqual('multifield@example.com');
    expect(result.role).toEqual('admin');
    expect(result.is_active).toEqual(false);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save changes to database', async () => {
    const userId = await createTestUser();

    const updateInput: UpdateUserInput = {
      id: userId,
      username: 'dbcheckuser',
      email: 'dbcheck@example.com'
    };

    await updateUser(updateInput);

    // Verify changes were persisted to database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].username).toEqual('dbcheckuser');
    expect(users[0].email).toEqual('dbcheck@example.com');
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should update updated_at timestamp', async () => {
    const userId = await createTestUser();

    // Get original updated_at
    const originalUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    const originalUpdatedAt = originalUser[0].updated_at;

    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const updateInput: UpdateUserInput = {
      id: userId,
      username: 'timestampuser'
    };

    const result = await updateUser(updateInput);

    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > originalUpdatedAt).toBe(true);
  });

  it('should throw error for non-existent user', async () => {
    const updateInput: UpdateUserInput = {
      id: 99999,
      username: 'nonexistent'
    };

    await expect(updateUser(updateInput)).rejects.toThrow(/user with id 99999 not found/i);
  });

  it('should handle partial updates correctly', async () => {
    const userId = await createTestUser();

    // Update only username, leave other fields unchanged
    const updateInput: UpdateUserInput = {
      id: userId,
      username: 'partialupdate'
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(userId);
    expect(result.username).toEqual('partialupdate');
    expect(result.email).toEqual('test@example.com'); // Original value
    expect(result.role).toEqual('employee'); // Original value
    expect(result.is_active).toEqual(true); // Original value
  });
});