import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { loginUser, hashPassword, createToken } from '../handlers/login_user';
import { randomBytes } from 'crypto';

const JWT_SECRET = process.env['JWT_SECRET'] || 'dev-secret-key';

// Helper function to create a test user with hashed password
async function createTestUser(userData: {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'employee';
  is_active?: boolean;
}) {
  const salt = randomBytes(16).toString('hex');
  const hashedPassword = hashPassword(userData.password, salt);
  const passwordHash = `${hashedPassword}:${salt}`;

  const [createdUser] = await db.insert(usersTable)
    .values({
      username: userData.username,
      email: userData.email,
      password_hash: passwordHash,
      role: userData.role,
      is_active: userData.is_active ?? true
    })
    .returning()
    .execute();

  return createdUser;
}

// Test user data
const testUserData = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'password123',
  role: 'admin' as const,
  is_active: true
};

const validLoginInput: LoginInput = {
  email: 'test@example.com',
  password: 'password123'
};

describe('loginUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should successfully authenticate valid credentials', async () => {
    const createdUser = await createTestUser(testUserData);

    const result = await loginUser(validLoginInput);

    // Verify user data is returned correctly
    expect(result.user.id).toEqual(createdUser.id);
    expect(result.user.username).toEqual(testUserData.username);
    expect(result.user.email).toEqual(testUserData.email);
    expect(result.user.role).toEqual(testUserData.role);
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');

    // Verify JWT token structure (should have 3 parts separated by dots)
    const tokenParts = result.token.split('.');
    expect(tokenParts).toHaveLength(3);

    // Decode and verify payload
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());
    expect(payload.userId).toEqual(createdUser.id);
    expect(payload.email).toEqual(testUserData.email);
    expect(payload.role).toEqual(testUserData.role);
    expect(payload.exp).toBeDefined();
    expect(payload.iat).toBeDefined();
    
    // Verify expiration is in the future
    expect(payload.exp * 1000).toBeGreaterThan(Date.now());
  });

  it('should reject invalid email', async () => {
    await createTestUser(testUserData);

    const invalidEmailInput: LoginInput = {
      email: 'nonexistent@example.com',
      password: 'password123'
    };

    await expect(loginUser(invalidEmailInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should reject invalid password', async () => {
    await createTestUser(testUserData);

    const invalidPasswordInput: LoginInput = {
      email: 'test@example.com',
      password: 'wrongpassword'
    };

    await expect(loginUser(invalidPasswordInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should reject inactive user', async () => {
    await createTestUser({ ...testUserData, is_active: false });

    await expect(loginUser(validLoginInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should work with employee role', async () => {
    const employeeUserData = {
      username: 'employee_user',
      email: 'employee@example.com',
      password: 'password123',
      role: 'employee' as const
    };

    const createdUser = await createTestUser(employeeUserData);

    const employeeLoginInput: LoginInput = {
      email: 'employee@example.com',
      password: 'password123'
    };

    const result = await loginUser(employeeLoginInput);

    expect(result.user.id).toEqual(createdUser.id);
    expect(result.user.username).toEqual('employee_user');
    expect(result.user.email).toEqual('employee@example.com');
    expect(result.user.role).toEqual('employee');
    expect(result.token).toBeDefined();

    // Verify JWT token contains correct role
    const tokenParts = result.token.split('.');
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());
    expect(payload.role).toEqual('employee');
  });

  it('should handle case-sensitive email matching', async () => {
    await createTestUser({ ...testUserData, email: testUserData.email.toLowerCase() });

    // Try to login with uppercase email
    const uppercaseEmailInput: LoginInput = {
      email: testUserData.email.toUpperCase(),
      password: testUserData.password
    };

    // Should fail because email matching is case-sensitive in database
    await expect(loginUser(uppercaseEmailInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should handle legacy password hash format without salt', async () => {
    // Create user with old format password hash (no salt separator)
    const legacyPasswordHash = hashPassword('password123', 'default-salt');
    
    const [createdUser] = await db.insert(usersTable)
      .values({
        username: 'legacy_user',
        email: 'legacy@example.com',
        password_hash: legacyPasswordHash, // No colon separator
        role: 'admin',
        is_active: true
      })
      .returning()
      .execute();

    const legacyLoginInput: LoginInput = {
      email: 'legacy@example.com',
      password: 'password123'
    };

    const result = await loginUser(legacyLoginInput);

    expect(result.user.id).toEqual(createdUser.id);
    expect(result.user.email).toEqual('legacy@example.com');
    expect(result.token).toBeDefined();
  });

  it('should create valid JWT token structure', async () => {
    const testPayload = { userId: 1, email: 'test@example.com', role: 'admin' };
    const token = createToken(testPayload, JWT_SECRET);

    // Verify token structure
    const parts = token.split('.');
    expect(parts).toHaveLength(3);

    // Verify header
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    expect(header.alg).toBe('HS256');
    expect(header.typ).toBe('JWT');

    // Verify payload
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    expect(payload.userId).toBe(1);
    expect(payload.email).toBe('test@example.com');
    expect(payload.role).toBe('admin');
    expect(payload.exp).toBeDefined();
    expect(payload.iat).toBeDefined();
  });
});