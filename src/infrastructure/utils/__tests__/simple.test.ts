import { PasswordHasher } from '../PasswordHasher';

describe('Simple PasswordHasher Test', () => {
  it('should hash and verify password', async () => {
    const hasher = new PasswordHasher();
    const password = 'testPassword123';
    
    const hash = await hasher.hash(password);
    const isValid = await hasher.verify(password, hash);
    
    expect(hash).toBeDefined();
    expect(isValid).toBe(true);
  });
});