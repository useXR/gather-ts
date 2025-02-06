// src/container/Container.ts

import { EventEmitter } from 'events';
import { ValidationError } from '@/errors';
import { 
  IContainer, 
  IServiceIdentifier,
  IServiceFactory,
  IServiceRegistration,
  IContainerEvents
} from './interfaces/IContainer';

export class Container extends EventEmitter implements IContainer {
  private static instance: Container;
  private services: Map<string, IServiceRegistration> = new Map();
  private isInitialized: boolean = false;
  private readonly debug: boolean;

  private constructor(debug: boolean = false) {
    super();
    this.debug = debug;
  }

  public static getInstance(debug: boolean = false): Container {
    if (!Container.instance) {
      Container.instance = new Container(debug);
    }
    return Container.instance;
  }

  private logDebug(message: string): void {
    if (this.debug) {
      console.debug(`[Container] ${message}`);
    }
  }

  public async initialize(): Promise<void> {
    this.logDebug('Initializing Container');
    
    try {
      if (this.isInitialized) {
        this.logDebug('Container already initialized');
        return;
      }

      this.emit('initialization:start', { timestamp: Date.now() });

      // Initialize all registered services that implement IService
      const initPromises = Array.from(this.services.values())
        .map(registration => registration.instance)
        .filter(instance => instance && 'initialize' in instance)
        .map(instance => (instance as any).initialize());

      await Promise.all(initPromises);

      this.isInitialized = true;
      this.emit('initialization:complete', { timestamp: Date.now() });
      this.logDebug('Container initialization complete');
    } catch (error) {
      this.handleError('initialization', error);
    }
  }

  public cleanup(): void {
    this.logDebug('Cleaning up Container');
    
    try {
      this.emit('cleanup:start', { timestamp: Date.now() });

      // Cleanup all registered services that implement IService
      Array.from(this.services.values())
        .map(registration => registration.instance)
        .filter(instance => instance && 'cleanup' in instance)
        .forEach(instance => (instance as any).cleanup());

      this.services.clear();
      this.isInitialized = false;
      
      this.emit('cleanup:complete', { timestamp: Date.now() });
      this.logDebug('Container cleanup complete');
    } catch (error) {
      this.handleError('cleanup', error);
    }
  }

  private handleError(operation: string, error: unknown): never {
    const message = error instanceof Error ? error.message : String(error);
    throw new ValidationError(`Container ${operation} failed: ${message}`);
  }

  public register<T>(token: IServiceIdentifier<T>, instance: T): void {
    this.logDebug(`Registering service: ${token}`);
    
    if (!token) {
      throw new ValidationError('Service token cannot be empty');
    }

    const tokenStr = token.toString();
    if (this.services.has(tokenStr)) {
      throw new ValidationError(`Service already registered: ${tokenStr}`);
    }

    this.services.set(tokenStr, {
      token,
      factory: () => instance,
      instance
    });

    this.emit('service:registered', {
      token: tokenStr,
      timestamp: Date.now()
    });
  }

  public registerFactory<T>(token: IServiceIdentifier<T>, factory: IServiceFactory<T>): void {
    this.logDebug(`Registering factory: ${token}`);
    
    if (!token) {
      throw new ValidationError('Service token cannot be empty');
    }

    if (!factory || typeof factory !== 'function') {
      throw new ValidationError('Factory must be a function');
    }

    const tokenStr = token.toString();
    this.services.set(tokenStr, {
      token,
      factory
    });

    this.emit('service:registered', {
      token: tokenStr,
      timestamp: Date.now()
    });
  }

  public resolve<T>(token: IServiceIdentifier<T>): T {
    if (!this.isInitialized) {
      throw new ValidationError('Container not initialized');
    }

    this.logDebug(`Resolving service: ${token}`);

    const tokenStr = token.toString();
    const registration = this.services.get(tokenStr);

    if (!registration) {
      throw new ValidationError(`No service registered for token: ${tokenStr}`);
    }

    try {
      if (!registration.instance) {
        registration.instance = registration.factory();
      }

      this.emit('service:resolved', {
        token: tokenStr,
        timestamp: Date.now()
      });

      return registration.instance as T;
    } catch (error) {
      this.emit('service:error', {
        token: tokenStr,
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now()
      });
      
      throw new ValidationError(
        `Failed to resolve service ${tokenStr}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  public hasService(token: IServiceIdentifier): boolean {
    return this.services.has(token.toString());
  }

  public clear(): void {
    this.logDebug('Clearing all services');
    this.cleanup();
  }
}

// Service tokens for type safety
export const ServiceTokens = {
  CONFIG_MANAGER: "ConfigManager",
  IGNORE_HANDLER: "IgnoreHandler",
  TOKEN_COUNTER: "TokenCounter",
  ERROR_HANDLER: "ErrorHandler",
  ERROR_UTILS: 'ErrorUtils',
  FILE_SYSTEM: "FileSystem",
  DEPENDENCY_ANALYZER: "DependencyAnalyzer",
  LOGGER: "Logger",
  TOKEN_CACHE: "TokenCache",
  COMPILER: "Compiler",
  VALIDATOR: "Validator",
  ARGUMENT_PARSER: "ArgumentParser",
} as const;

export type ServiceToken = (typeof ServiceTokens)[keyof typeof ServiceTokens];