// src/container/interfaces/IContainer.ts

import { IService } from '@/types/services';

export interface IContainerOptions {
  debug?: boolean;
  maxCacheAge?: number;
  fileExtensions?: string[];
  customTsConfigPath?: string;
  batchSize?: number;
}

export interface IServiceIdentifier<T = any> {
  toString(): string;
}

export interface IServiceFactory<T = any> {
  (): T | Promise<T>;
}

export interface IServiceRegistration<T = any> {
  token: IServiceIdentifier<T>;
  factory: IServiceFactory<T>;
  instance?: T;
  dependencies?: IServiceIdentifier[];
}

export interface IContainerEvents {
  'service:registered': { token: string; timestamp: number };
  'service:resolved': { token: string; timestamp: number };
  'service:error': { token: string; error: Error; timestamp: number };
  'initialization:start': { timestamp: number };
  'initialization:complete': { timestamp: number };
  'cleanup:start': { timestamp: number };
  'cleanup:complete': { timestamp: number };
}

export interface IContainer extends IService {
  register<T>(token: IServiceIdentifier<T>, instance: T): void;
  registerFactory<T>(token: IServiceIdentifier<T>, factory: IServiceFactory<T>): void;
  resolve<T>(token: IServiceIdentifier<T>): T;
  hasService(token: IServiceIdentifier): boolean;
  clear(): void;

  on<K extends keyof IContainerEvents>(
    event: K,
    listener: (data: IContainerEvents[K]) => void
  ): this;

  off<K extends keyof IContainerEvents>(
    event: K,
    listener: (data: IContainerEvents[K]) => void
  ): this;

  emit<K extends keyof IContainerEvents>(
    event: K,
    data: IContainerEvents[K]
  ): boolean;
}

export interface IContainerConfiguration {
  configureContainer(rootDir: string, options?: IContainerOptions): IContainer;
}