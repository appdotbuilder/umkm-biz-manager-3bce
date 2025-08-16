import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { getUsers } from '../handlers/get_users';

describe('getUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no users exist', async () => {
    const result = await getUsers();

    expect(result).toEqual([]);
  });

  it('should return all users without password_hash', async () => {
    // Create test users
    const hashedPassword = 'hashed_password_123';
    
    await db.insert(usersTable).values([
      {
        username: 'admin_user',
        email: 'admin@test.com',
        password_hash: hashedPassword,
        role: 'admin',
        is_active: true
      },
      {
        username: 'employee_user',
        email: 'employee@test.com',
        password_hash: hashedPassword,
        role: 'employee',
        is_active: false
      }
    ]).execute();

    const result = await getUsers();

    expect(result).toHaveLength(2);

    // Check first user
    const adminUser = result.find(u => u.username === 'admin_user');
    expect(adminUser).toBeDefined();
    expect(adminUser!.email).toEqual('admin@test.com');
    expect(adminUser!.role).toEqual('admin');
    expect(adminUser!.is_active).toBe(true);
    expect(adminUser!.id).toBeDefined();
    expect(adminUser!.created_at).toBeInstanceOf(Date);
    expect(adminUser!.updated_at).toBeInstanceOf(Date);
    expect((adminUser as any).password_hash).toBeUndefined();

    // Check second user
    const employeeUser = result.find(u => u.username === 'employee_user');
    expect(employeeUser).toBeDefined();
    expect(employeeUser!.email).toEqual('employee@test.com');
    expect(employeeUser!.role).toEqual('employee');
    expect(employeeUser!.is_active).toBe(false);
    expect(employeeUser!.id).toBeDefined();
    expect(employeeUser!.created_at).toBeInstanceOf(Date);
    expect(employeeUser!.updated_at).toBeInstanceOf(Date);
    expect((employeeUser as any).password_hash).toBeUndefined();
  });

  it('should return users in consistent order', async () => {
    // Create multiple users
    const hashedPassword = 'hashed_password_123';
    
    const usernames = ['user_a', 'user_b', 'user_c'];
    
    for (const username of usernames) {
      await db.insert(usersTable).values({
        username,
        email: `${username}@test.com`,
        password_hash: hashedPassword,
        role: 'employee',
        is_active: true
      }).execute();
    }

    const result1 = await getUsers();
    const result2 = await getUsers();

    expect(result1).toHaveLength(3);
    expect(result2).toHaveLength(3);

    // Results should be consistent between calls
    expect(result1.map(u => u.username)).toEqual(result2.map(u => u.username));
    
    // All usernames should be present
    const returnedUsernames = result1.map(u => u.username);
    expect(returnedUsernames).toContain('user_a');
    expect(returnedUsernames).toContain('user_b');
    expect(returnedUsernames).toContain('user_c');
  });

  it('should include both active and inactive users', async () => {
    const hashedPassword = 'hashed_password_123';
    
    await db.insert(usersTable).values([
      {
        username: 'active_user',
        email: 'active@test.com',
        password_hash: hashedPassword,
        role: 'admin',
        is_active: true
      },
      {
        username: 'inactive_user',
        email: 'inactive@test.com',
        password_hash: hashedPassword,
        role: 'employee',
        is_active: false
      }
    ]).execute();

    const result = await getUsers();

    expect(result).toHaveLength(2);
    
    const activeUser = result.find(u => u.username === 'active_user');
    const inactiveUser = result.find(u => u.username === 'inactive_user');
    
    expect(activeUser?.is_active).toBe(true);
    expect(inactiveUser?.is_active).toBe(false);
  });
});