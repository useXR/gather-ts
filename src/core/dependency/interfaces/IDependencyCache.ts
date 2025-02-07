// src/core/dependency/interfaces/IDependencyCache.ts

import { IDependencyMap } from "@/types";
import { IService } from "@/types/services";
import { ILogger } from "@/utils/logging/interfaces/ILogger";

export interface IDependencyCacheDeps {
  logger: ILogger;
}

export interface IDependencyCacheOptions {
  debug?: boolean;
  timeout?: number;
}

export interface ICacheOperationOptions {
  timeout?: number;
  force?: boolean;
}

export interface IDependencyCacheEntry {
  dependencies: IDependencyMap;
  timestamp: number;
  hash: string;
  timeout: number;
}

export interface IDependencyCacheStats {
  size: number;
  hits: number;
  misses: number;
  oldestEntry: number | null;
  averageAge: number;
  invalidations: number;
  errors: number;
}

export interface IDependencyCache extends IService {
  get(key: string, options?: ICacheOperationOptions): IDependencyMap | null;
  set(
    key: string,
    dependencies: IDependencyMap,
    options?: ICacheOperationOptions,
  ): void;
  delete(key: string): void;
  clear(): void;
  has(key: string): boolean;
  getStats(): IDependencyCacheStats;
}
