import { PasswordHasher } from '../PasswordHasher';

describe('PasswordHasher', () => {
  let passwordHasher: PasswordHasher;

  beforeEach(() => {
    passwordHasher = new PasswordHasher();
  });

  describe('hash', () => {
    it('should hash a password', async () => {
      // Arrange
      const password = 'testPassword123';

      // Act
      const hash = await passwordHasher.hash(password);

      // Assert
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are typically 60 characters
    });

    it('should generate different hashes for the same password', async () => {
      // Arrange
      const password = 'testPassword123';

      // Act
      const hash1 = await passwordHasher.hash(password);
      const hash2 = await passwordHasher.hash(password);

      // Assert
      expect(hash1).not.toBe(hash2); // Due to salt, hashes should be different
    });
  });

  describe('verify', () => {
    it('should verify a correct password', async () => {
      // Arrange
      const password = 'testPassword123';
      const hash = await passwordHasher.hash(password);

      // Act
      const isValid = await passwordHasher.verify(password, hash);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      // Arrange
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword456';
      const hash = await passwordHasher.hash(password);

      // Act
      const isValid = await passwordHasher.verify(wrongPassword, hash);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should reject empty password', async () => {
      // Arrange
      const password = 'testPassword123';
      const hash = await passwordHasher.hash(password);

      // Act
      const isValid = await passwordHasher.verify('', hash);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should handle invalid hash gracefully', async () => {
      // Arrange
      const password = 'testPassword123';
      const invalidHash = 'invalid-hash';

      // Act & Assert
      await expect(passwordHasher.verify(password, invalidHash))
        .rejects.toThrow();
    });
  });
});