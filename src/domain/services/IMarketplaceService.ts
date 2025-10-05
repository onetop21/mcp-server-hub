import { MarketplaceServer, MarketplaceServerCreate, MarketplaceServerUpdate } from '../models/MarketplaceServer';

/**
 * Marketplace Service Interface
 * 
 * Manages marketplace server templates
 */
export interface IMarketplaceService {
  /**
   * List all marketplace servers (public)
   */
  listMarketplaceServers(tags?: string[], search?: string): Promise<MarketplaceServer[]>;

  /**
   * Get marketplace server details
   */
  getMarketplaceServer(marketplaceId: string): Promise<MarketplaceServer | null>;

  /**
   * Register marketplace server (admin only)
   */
  registerMarketplaceServer(adminUserId: string, data: MarketplaceServerCreate): Promise<MarketplaceServer>;

  /**
   * Update marketplace server (admin only)
   */
  updateMarketplaceServer(marketplaceId: string, adminUserId: string, updates: MarketplaceServerUpdate): Promise<MarketplaceServer>;

  /**
   * Delete marketplace server (admin only)
   */
  deleteMarketplaceServer(marketplaceId: string, adminUserId: string): Promise<void>;

  /**
   * Increment install count
   */
  incrementInstallCount(marketplaceId: string): Promise<void>;
}

export const MARKETPLACE_SERVICE = Symbol.for('MarketplaceService');

