"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketplaceService = void 0;
const inversify_1 = require("inversify");
const MarketplaceRepository_1 = require("../../infrastructure/repositories/MarketplaceRepository");
const types_1 = require("../../infrastructure/di/types");
/**
 * Marketplace Service Implementation
 *
 * Manages marketplace server templates
 */
let MarketplaceService = class MarketplaceService {
    constructor(repository, userService) {
        this.repository = repository;
        this.userService = userService;
    }
    async listMarketplaceServers(tags, search) {
        return this.repository.list(tags, search);
    }
    async getMarketplaceServer(marketplaceId) {
        return this.repository.findById(marketplaceId);
    }
    async registerMarketplaceServer(adminUserId, data) {
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
    async updateMarketplaceServer(marketplaceId, adminUserId, updates) {
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
    async deleteMarketplaceServer(marketplaceId, adminUserId) {
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
    async incrementInstallCount(marketplaceId) {
        await this.repository.incrementInstallCount(marketplaceId);
    }
};
MarketplaceService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)('MarketplaceRepository')),
    __param(1, (0, inversify_1.inject)(types_1.TYPES.UserManagementService)),
    __metadata("design:paramtypes", [MarketplaceRepository_1.MarketplaceRepository, Object])
], MarketplaceService);
exports.MarketplaceService = MarketplaceService;
