"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const User_1 = require("../../domain/models/User");
const BaseRepository_1 = require("../database/BaseRepository");
/**
 * User repository for database operations
 */
class UserRepository extends BaseRepository_1.BaseRepository {
    constructor(db) {
        super(db, 'users');
    }
    /**
     * Convert database row to domain model
     */
    toDomainModel(row) {
        return {
            id: row.id,
            email: row.email,
            username: row.username,
            passwordHash: row.password_hash,
            subscription: row.subscription,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    /**
     * Convert domain model to database row
     */
    toDbRow(user) {
        const row = {};
        if (user.email !== undefined)
            row.email = user.email;
        if (user.username !== undefined)
            row.username = user.username;
        if (user.passwordHash !== undefined)
            row.password_hash = user.passwordHash;
        if (user.subscription !== undefined)
            row.subscription = user.subscription;
        if (user.createdAt !== undefined)
            row.created_at = user.createdAt;
        if (user.updatedAt !== undefined)
            row.updated_at = user.updatedAt;
        return row;
    }
    /**
     * Find user by ID
     */
    async findUserById(id) {
        const row = await super.findById(id);
        return row ? this.toDomainModel(row) : null;
    }
    /**
     * Find user by email
     */
    async findByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = $1';
        const row = await this.findOneByQuery(query, [email]);
        return row ? this.toDomainModel(row) : null;
    }
    /**
     * Find user by username
     */
    async findByUsername(username) {
        const query = 'SELECT * FROM users WHERE username = $1';
        const row = await this.findOneByQuery(query, [username]);
        return row ? this.toDomainModel(row) : null;
    }
    /**
     * Create a new user
     */
    async createUser(userData) {
        const dbRow = this.toDbRow(userData);
        const createdRow = await super.create(dbRow);
        return this.toDomainModel(createdRow);
    }
    /**
     * Update user
     */
    async updateUser(id, userData) {
        const dbRow = this.toDbRow(userData);
        const updatedRow = await super.update(id, dbRow);
        return updatedRow ? this.toDomainModel(updatedRow) : null;
    }
    /**
     * Get all users with pagination
     */
    async findAllWithPagination(offset = 0, limit = 50) {
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
    async findBySubscription(subscription) {
        const rows = await this.findAll({ subscription });
        return rows.map(row => this.toDomainModel(row));
    }
    /**
     * Check if email exists
     */
    async emailExists(email) {
        const query = 'SELECT 1 FROM users WHERE email = $1 LIMIT 1';
        const result = await this.db.query(query, [email]);
        return result.rows.length > 0;
    }
    /**
     * Check if username exists
     */
    async usernameExists(username) {
        const query = 'SELECT 1 FROM users WHERE username = $1 LIMIT 1';
        const result = await this.db.query(query, [username]);
        return result.rows.length > 0;
    }
    /**
     * Update user's last login time
     */
    async updateLastLogin(id) {
        const query = 'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1';
        await this.db.query(query, [id]);
    }
    /**
     * Get user statistics
     */
    async getStatistics() {
        const total = await this.count();
        const subscriptionQuery = `
      SELECT subscription, COUNT(*) as count 
      FROM users 
      GROUP BY subscription
    `;
        const result = await this.db.query(subscriptionQuery);
        const bySubscription = {};
        // Initialize all subscription tiers with 0
        Object.values(User_1.SubscriptionTier).forEach(tier => {
            bySubscription[tier] = 0;
        });
        // Fill in actual counts
        result.rows.forEach(row => {
            bySubscription[row.subscription] = parseInt(row.count, 10);
        });
        return { total, bySubscription };
    }
}
exports.UserRepository = UserRepository;
