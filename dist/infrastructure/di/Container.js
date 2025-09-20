"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.container = exports.DIContainer = void 0;
const inversify_1 = require("inversify");
require("reflect-metadata");
class DIContainer {
    static getInstance() {
        if (!DIContainer.instance) {
            DIContainer.instance = new inversify_1.Container();
            DIContainer.configureContainer();
        }
        return DIContainer.instance;
    }
    static configureContainer() {
        const container = DIContainer.instance;
        // Service bindings will be added as implementations are created
        // For now, we're just setting up the container structure
        // Example binding (to be replaced with actual implementations):
        // container.bind<UserManagementService>(USER_MANAGEMENT_SERVICE).to(UserManagementServiceImpl);
    }
    static reset() {
        DIContainer.instance = new inversify_1.Container();
        DIContainer.configureContainer();
    }
}
exports.DIContainer = DIContainer;
exports.container = DIContainer.getInstance();
