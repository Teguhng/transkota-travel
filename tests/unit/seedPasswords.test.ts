import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
const mockCompare = vi.fn();
const mockGenSalt = vi.fn();
const mockHash = vi.fn();

vi.mock('../../src/config/database.js', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
    end: vi.fn(),
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    genSalt: (...args: unknown[]) => mockGenSalt(...args),
    hash: (...args: unknown[]) => mockHash(...args),
    compare: (...args: unknown[]) => mockCompare(...args),
  },
}));

import { ensureDemoPasswordsSeeded } from '../../src/scripts/seedPasswords.js';

describe('seedPasswords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenSalt.mockResolvedValue('salt-10');
    mockHash.mockResolvedValue('$2a$10$hashedpassword');
  });

  it('melewati bcrypt dan update ketika semua akun demo sudah memiliki password_hash', async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const updated = await ensureDemoPasswordsSeeded();

    expect(updated).toBe(0);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockGenSalt).not.toHaveBeenCalled();
    expect(mockHash).not.toHaveBeenCalled();
  });

  it('mengisi password_hash hanya untuk akun demo yang masih NULL dan melengkapi telepon operator_1', async () => {
    mockQuery
      .mockResolvedValueOnce([[{ username: 'admin_1' }, { username: 'operator_1' }, { username: 'aziz' }], []])
      .mockResolvedValueOnce([{ affectedRows: 3 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const updated = await ensureDemoPasswordsSeeded();

    expect(updated).toBe(3);
    expect(mockGenSalt).toHaveBeenCalledWith(10);
    expect(mockHash).toHaveBeenCalledWith('Password123!', 'salt-10');
    expect(mockQuery).toHaveBeenCalledTimes(3);
    const updateSql = String(mockQuery.mock.calls[1][0]);
    expect(updateSql).toContain('password_hash IS NULL');
  });

  it('mendukung mode force=true untuk menyetel ulang seluruh akun demo via CLI', async () => {
    mockQuery
      .mockResolvedValueOnce([{ affectedRows: 3 }, []])
      .mockResolvedValueOnce([{ affectedRows: 0 }, []]);

    const updated = await ensureDemoPasswordsSeeded({ force: true });

    expect(updated).toBe(3);
    expect(mockQuery).toHaveBeenCalledTimes(2);
    const updateSql = String(mockQuery.mock.calls[0][0]);
    expect(updateSql).not.toContain('password_hash IS NULL');
  });
});
