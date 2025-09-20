import { Container } from 'inversify';
import 'reflect-metadata';
export declare class DIContainer {
    private static instance;
    static getInstance(): Container;
    private static configureContainer;
    static reset(): void;
}
export declare const container: Container;
//# sourceMappingURL=Container.d.ts.map