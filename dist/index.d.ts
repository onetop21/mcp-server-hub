import 'reflect-metadata';
export declare class Application {
    private container;
    start(): Promise<void>;
    stop(): Promise<void>;
}
export { container } from './infrastructure/di/container';
export * from './domain/models';
export * from './domain/services';
//# sourceMappingURL=index.d.ts.map