import { UserRepository } from '../UserRepository';
import { DatabaseConnection } from '../../database/connection';
import { SubscriptionTier } from '../../../domain/models/User';

// Mock DatabaseConnection
const mockDb = {
  query: jest.fn(),
  transaction: jest.fn(),
  getClient: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  isConnected: jest.fn(),
  getPoolStats: jest.fn(),
} as jest.Mocked<DatabaseConnection>;

describe('UserRepository', () => {
  let userRepository: UserRepository;

  beforeEach(() => {
    userRepository = new UserRepository(mockDb);
    jest.clearAllMocks();
  });

  describe('findByEmail', () => {
    test('should find user by email', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        password_hash: 'hashed-password',
        subscription: 'free',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockUser] });

      const result = await userRepository.findByEmail('test@example.com');

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1',
        ['test@example.com']
      );
      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hashed-password',
        subscription: SubscriptionTier.FREE,
        createdAt: mockUser.created_at,
        updatedAt: mockUser.updated_at,
      });
    });

    test('should return null when user not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await userRepository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    test('should find user by username', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        password_hash: 'hashed-password',
        subscription: 'basic',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockUser] });

      const result = await userRepository.findByUsername('testuser');

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE username = $1',
        ['testuser']
      );
      expect(result?.subscription).toBe(SubscriptionTier.BASIC);
    });
  });

  describe('emailExists', () => {
    test('should return true when email exists', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ exists: true }] });

      const result = await userRepository.emailExists('test@example.com');

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT 1 FROM users WHERE email = $1 LIMIT 1',
        ['test@example.com']
      );
      expect(result).toBe(true);
    });

    test('should return false when email does not exist', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await userRepository.emailExists('nonexistent@example.com');

      expect(result).toBe(false);
    });
  });

  describe('usernameExists', () => {
    test('should return true when username exists', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ exists: true }] });

      const result = await userRepository.usernameExists('testuser');

      expect(result).toBe(true);
    });

    test('should return false when username does not exist', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await userRepository.usernameExists('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getStatistics', () => {
    test('should return user statistics', async () => {
      // Mock total count
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 100 }) // count query
        .mockResolvedValueOnce({
          rows: [
            { subscription: 'free', count: '80' },
            { subscription: 'basic', count: '15' },
            { subscription: 'premium', count: '5' },
          ],
        });

      // Mock the count method
      jest.spyOn(userRepository, 'count').mockResolvedValue(100);

      const result = await userRepository.getStatistics();

      expect(result).toEqual({
        total: 100,
        bySubscription: {
          free: 80,
          basic: 15,
          premium: 5,
          enterprise: 0,
        },
      });
    });
  });
});