import { Container } from 'inversify';
import 'reflect-metadata';
/**
 * IoC Container configuration for the MCP Hub Router
 *
 * This container manages all dependencies and their lifecycles.
 * Services are registered here and can be injected into other components.
 */
export declare class DIContainer {
    private static instance;
    /**
     * Get the singleton container instance
     */
    static getInstance(): Container;
    /**
     * Configure all service bindings
     */
    private static configureContainer;
    /**
     * Reset the container (useful for testing)
     */
    static reset(): void;
    /**
     * Get a service from the container
     */
    static get<T>(serviceIdentifier: symbol): T;
    /**
     * Check if a service is bound
     */
    static isBound(serviceIdentifier: symbol): boolean;
}
export declare const container: Container;
//# sourceMappingURL=container.d.ts.map