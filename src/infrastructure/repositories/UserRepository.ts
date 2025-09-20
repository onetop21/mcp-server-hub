import { User, SubscriptionTier } from '../../domain/models/User';
import { BaseRepository } from '../database/BaseRepository';
import { DatabaseConnection } from '../database/connection';

/**
 * Database representation of User
 */
interface UserRow {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  subscription: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * User repository for database operations
 */
export class UserRepository extends BaseRepository<UserRow> {
  constructor(db: DatabaseConnection) {
    super(db, 'users');
  }

  /**
   * Convert database row to domain model
   */
  private toDomainModel(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      passwordHash: row.password_hash,
      subscription: row.subscription as SubscriptionTier,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Convert domain model to database row
   */
  private toDbRow(user: Partial<User>): Partial<UserRow> {
    const row: Partial<UserRow> = {};
    
    if (user.email !== undefined) row.email = user.email;
    if (user.username !== undefined) row.username = user.username;
    if (user.passwordHash !== undefined) row.password_hash = user.passwordHash;
    if (user.subscription !== undefined) row.subscription = user.subscription;
    if (user.createdAt !== undefined) row.created_at = user.createdAt;
    if (user.updatedAt !== undefined) row.updated_at = user.updatedAt;

    return row;
  }

  /**
   * Find user by ID
   */
  async findUserById(id: string): Promise<User | null> {
    const row = await super.findById(id);
    return row ? this.toDomainModel(row) : null;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const row = await this.findOneByQuery(query, [email]);
    return row ? this.toDomainModel(row) : null;
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE username = $1';
    const row = await this.findOneByQuery(query, [username]);
    return row ? this.toDomainModel(row) : null;
  }

  /**
   * Create a new user
   */
  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const dbRow = this.toDbRow(userData);
    const createdRow = await super.create(dbRow);
    return this.toDomainModel(createdRow);
  }

  /**
   * Update user
   */
  async updateUser(id: string, userData: Partial<User>): Promise<User | null> {
    const dbRow = this.toDbRow(userData);
    const updatedRow = await super.update(id, dbRow);
    return updatedRow ? this.toDomainModel(updatedRow) : null;
  }

  /**
   * Get all users with pagination
   */
  async findAllWithPagination(
    offset: number = 0,
    limit: number = 50
  ): Promise<{ users: User[]; total: number }> {
    const query = `
      SELECT * FROM users 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `;
    
    const rows = await this.findByQuery(query, [limit, offset]);
    const total = await this.count();
    
    return {
      users: rows.map(row => this.toDomainModel(row)),
      total,
    };
  }

  /**
   * Find users by subscription tier
   */
  async findBySubscription(subscription: SubscriptionTier): Promise<User[]> {
    const rows = await this.findAll({ subscription });
    return rows.map(row => this.toDomainModel(row));
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const query = 'SELECT 1 FROM users WHERE email = $1 LIMIT 1';
    const result = await this.db.query(query, [email]);
    return result.rows.length > 0;
  }

  /**
   * Check if username exists
   */
  async usernameExists(username: string): Promise<boolean> {
    const query = 'SELECT 1 FROM users WHERE username = $1 LIMIT 1';
    const result = await this.db.query(query, [username]);
    return result.rows.length > 0;
  }

  /**
   * Update user's last login time
   */
  async updateLastLogin(id: string): Promise<void> {
    const query = 'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1';
    await this.db.query(query, [id]);
  }

  /**
   * Get user statistics
   */
  async getStatistics(): Promise<{
    total: number;
    bySubscription: Record<SubscriptionTier, number>;
  }> {
    const total = await this.count();
    
    const subscriptionQuery = `
      SELECT subscription, COUNT(*) as count 
      FROM users 
      GROUP BY subscription
    `;
    
    const result = await this.db.query<{ subscription: string; count: string }>(
      subscriptionQuery
    );
    
    const bySubscription = {} as Record<SubscriptionTier, number>;
    
    // Initialize all subscription tiers with 0
    Object.values(SubscriptionTier).forEach(tier => {
      bySubscription[tier] = 0;
    });
    
    // Fill in actual counts
    result.rows.forEach(row => {
      bySubscription[row.subscription as SubscriptionTier] = parseInt(row.count, 10);
    });
    
    return { total, bySubscription };
  }
}