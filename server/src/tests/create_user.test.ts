import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';

// Helper function to verify password hash
const verifyPassword = (password: string, hash: string): boolean => {
  const [hashPart, salt] = hash.split(':');
  const expectedHash = createHash('sha256').update(password + salt).digest('hex');
  return hashPart === expectedHash;
};

// Test input with all required fields
const testInput: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'testpassword123',
  role: 'employee'
};

const adminInput: CreateUserInput = {
  username: 'adminuser',
  email: 'admin@example.com',
  password: 'adminpassword123',
  role: 'admin'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with employee role', async () => {
    const result = await createUser(testInput);

    // Basic field validation
    expect(result.username).toEqual('testuser');
    expect(result.email).toEqual('test@example.com');
    expect(result.role).toEqual('employee');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(typeof result.id).toEqual('number');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Password should be hashed, not plain text
    expect(result.password_hash).not.toEqual('testpassword123');
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash.length).toBeGreaterThan(0);
  });

  it('should create a user with admin role', async () => {
    const result = await createUser(adminInput);

    expect(result.username).toEqual('adminuser');
    expect(result.email).toEqual('admin@example.com');
    expect(result.role).toEqual('admin');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should hash password correctly', async () => {
    const result = await createUser(testInput);

    // Verify the password was hashed correctly
    const isValidHash = verifyPassword('testpassword123', result.password_hash);
    expect(isValidHash).toBe(true);

    // Verify wrong password doesn't match
    const isInvalidHash = verifyPassword('wrongpassword', result.password_hash);
    expect(isInvalidHash).toBe(false);
  });

  it('should save user to database', async () => {
    const result = await createUser(testInput);

    // Query the database directly to verify user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].username).toEqual('testuser');
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].role).toEqual('employee');
    expect(users[0].is_active).toEqual(true);
    expect(users[0].created_at).toBeInstanceOf(Date);
    expect(users[0].updated_at).toBeInstanceOf(Date);

    // Verify password hash is stored correctly
    const isValidHash = verifyPassword('testpassword123', users[0].password_hash);
    expect(isValidHash).toBe(true);
  });

  it('should throw error for duplicate username', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create second user with same username
    const duplicateUsernameInput: CreateUserInput = {
      username: 'testuser', // Same username
      email: 'different@example.com',
      password: 'password123',
      role: 'admin'
    };

    await expect(createUser(duplicateUsernameInput)).rejects.toThrow(/unique/i);
  });

  it('should throw error for duplicate email', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create second user with same email
    const duplicateEmailInput: CreateUserInput = {
      username: 'differentuser',
      email: 'test@example.com', // Same email
      password: 'password123',
      role: 'admin'
    };

    await expect(createUser(duplicateEmailInput)).rejects.toThrow(/unique/i);
  });

  it('should create multiple users with different usernames and emails', async () => {
    const user1 = await createUser(testInput);
    const user2 = await createUser(adminInput);

    // Both users should be created successfully
    expect(user1.id).not.toEqual(user2.id);
    expect(user1.username).toEqual('testuser');
    expect(user2.username).toEqual('adminuser');
    expect(user1.email).toEqual('test@example.com');
    expect(user2.email).toEqual('admin@example.com');

    // Verify both are in database
    const allUsers = await db.select().from(usersTable).execute();
    expect(allUsers).toHaveLength(2);
  });

  it('should generate different hashes for same password', async () => {
    // Create two users with same password
    const user1Input: CreateUserInput = {
      username: 'user1',
      email: 'user1@example.com',
      password: 'samepassword',
      role: 'employee'
    };

    const user2Input: CreateUserInput = {
      username: 'user2',
      email: 'user2@example.com',
      password: 'samepassword',
      role: 'employee'
    };

    const user1 = await createUser(user1Input);
    const user2 = await createUser(user2Input);

    // Hashes should be different due to salt
    expect(user1.password_hash).not.toEqual(user2.password_hash);

    // But both should validate against the same password
    const user1Valid = verifyPassword('samepassword', user1.password_hash);
    const user2Valid = verifyPassword('samepassword', user2.password_hash);
    expect(user1Valid).toBe(true);
    expect(user2Valid).toBe(true);
  });
});