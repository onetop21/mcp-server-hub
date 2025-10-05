import { injectable, inject } from 'inversify';
import { IMarketplaceService } from './IMarketplaceService';
import { MarketplaceServer, MarketplaceServerCreate, MarketplaceServerUpdate } from '../models/MarketplaceServer';
import { MarketplaceRepository } from '../../infrastructure/repositories/MarketplaceRepository';
import { IUserManagementService } from './IUserManagementService';
import { TYPES } from '../../infrastructure/di/types';

/**
 * Marketplace Service Implementation
 * 
 * Manages marketplace server templates
 */
@injectable()
export class MarketplaceService implements IMarketplaceService {
  constructor(
    @inject('MarketplaceRepository') private repository: MarketplaceRepository,
    @inject(TYPES.UserManagementService) private userService: IUserManagementService
  ) {}

  async listMarketplaceServers(tags?: string[], search?: string): Promise<MarketplaceServer[]> {
    return this.repository.list(tags, search);
  }

  async getMarketplaceServer(marketplaceId: string): Promise<MarketplaceServer | null> {
    return this.repository.findById(marketplaceId);
  }

  async registerMarketplaceServer(adminUserId: string, data: MarketplaceServerCreate): Promise<MarketplaceServer> {
    // Verify admin
    const user = await this.userService.getUserById(adminUserId);
    if (!user) {
      throw new Error('User not found');
    }

    // TODO: Check if user is admin (for now, all users can register)
    // if (!user.isAdmin) {
    //   throw new Error('Unauthorized: Admin access required');
    // }

    return this.repository.create(data, adminUserId);
  }

  async updateMarketplaceServer(
    marketplaceId: string,
    adminUserId: string,
    updates: MarketplaceServerUpdate
  ): Promise<MarketplaceServer> {
    // Verify admin
    const user = await this.userService.getUserById(adminUserId);
    if (!user) {
      throw new Error('User not found');
    }

    const server = await this.repository.findById(marketplaceId);
    if (!server) {
      throw new Error(`Marketplace server '${marketplaceId}' not found`);
    }

    // TODO: Check if user is admin or creator
    // if (!user.isAdmin && server.createdBy !== adminUserId) {
    //   throw new Error('Unauthorized');
    // }

    return this.repository.update(marketplaceId, updates);
  }

  async deleteMarketplaceServer(marketplaceId: string, adminUserId: string): Promise<void> {
    // Verify admin
    const user = await this.userService.getUserById(adminUserId);
    if (!user) {
      throw new Error('User not found');
    }

    const server = await this.repository.findById(marketplaceId);
    if (!server) {
      throw new Error(`Marketplace server '${marketplaceId}' not found`);
    }

    // TODO: Check if user is admin or creator
    // if (!user.isAdmin && server.createdBy !== adminUserId) {
    //   throw new Error('Unauthorized');
    // }

    await this.repository.delete(marketplaceId);
  }

  async incrementInstallCount(marketplaceId: string): Promise<void> {
    await this.repository.incrementInstallCount(marketplaceId);
  }
}

