import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

const JWT_SECRET = process.env['JWT_SECRET'] || 'dev-secret-key';

// Simple password hashing using built-in crypto
function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(password + salt).digest('hex');
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const expectedHash = hashPassword(password, salt);
  // Use timing-safe comparison to prevent timing attacks
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const actualBuffer = Buffer.from(hash, 'hex');
  
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

// Simple JWT implementation using built-in crypto
function createToken(payload: object, secret: string, expiresIn: string = '24h'): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  // Calculate expiration (24h from now)
  const expirationMs = Date.now() + (24 * 60 * 60 * 1000); // 24 hours in ms
  const fullPayload = {
    ...payload,
    exp: Math.floor(expirationMs / 1000), // JWT exp is in seconds
    iat: Math.floor(Date.now() / 1000) // issued at
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  
  const signature = createHash('sha256')
    .update(`${encodedHeader}.${encodedPayload}`)
    .update(secret)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export async function loginUser(input: LoginInput): Promise<{ user: { id: number; username: string; email: string; role: string }; token: string }> {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    const user = users[0];

    // Check if user exists and is active
    if (!user || !user.is_active) {
      throw new Error('Invalid email or password');
    }

    // For this implementation, we'll assume password_hash contains "hash:salt"
    // In a real implementation, you'd store these separately or use bcrypt
    const [storedHash, salt] = user.password_hash.includes(':') 
      ? user.password_hash.split(':')
      : [user.password_hash, 'default-salt']; // Fallback for existing data

    // Verify password
    const isPasswordValid = verifyPassword(input.password, storedHash, salt);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = createToken(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET
    );

    // Return user data (excluding password hash) and token
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      token
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

// Export helper functions for testing
export { hashPassword, verifyPassword, createToken };