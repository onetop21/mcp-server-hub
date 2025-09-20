import * as bcrypt from 'bcryptjs';

/**
 * Password hashing utility using bcrypt
 */
export class PasswordHasher {
  private readonly saltRounds: number = 12;

  /**
   * Hash a plain text password
   */
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Verify a password against a hash
   */
  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}