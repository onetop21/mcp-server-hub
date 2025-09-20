import { User, SubscriptionTier, UserCreateRequest } from '../User';

describe('User Model', () => {
  test('should define SubscriptionTier enum correctly', () => {
    expect(SubscriptionTier.FREE).toBe('free');
    expect(SubscriptionTier.BASIC).toBe('basic');
    expect(SubscriptionTier.PREMIUM).toBe('premium');
    expect(SubscriptionTier.ENTERPRISE).toBe('enterprise');
  });

  test('should create User object with correct properties', () => {
    const user: User = {
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      passwordHash: 'hashed-password',
      createdAt: new Date(),
      updatedAt: new Date(),
      subscription: SubscriptionTier.FREE
    };

    expect(user.id).toBe('user-123');
    expect(user.email).toBe('test@example.com');
    expect(user.subscription).toBe(SubscriptionTier.FREE);
  });

  test('should create UserCreateRequest with correct properties', () => {
    const createRequest: UserCreateRequest = {
      email: 'new@example.com',
      username: 'newuser',
      password: 'password123',
      subscription: SubscriptionTier.BASIC
    };

    expect(createRequest.email).toBe('new@example.com');
    expect(createRequest.username).toBe('newuser');
    expect(createRequest.subscription).toBe(SubscriptionTier.BASIC);
  });
});