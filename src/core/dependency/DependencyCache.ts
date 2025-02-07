// src/core/dependency/DependencyCache.ts

import { CacheError } from "@/errors";
import {
  IDependencyCache,
  IDependencyCacheEntry,
  IDependencyCacheStats,
  IDependencyCacheDeps,
  IDependencyCacheOptions,
  ICacheOperationOptions,
} from "./interfaces/IDependencyCache";
import { IDependencyMap } from "@/types";

export class DependencyCache implements IDependencyCache {
  private cache: Map<string, IDependencyCacheEntry>;
  private readonly debug: boolean;
  private readonly timeout: number;
  private stats: IDependencyCacheStats;
  isInitialized: boolean = false;
  private cacheDuration: number;

  constructor(
    private readonly deps: IDependencyCacheDeps,
    options: IDependencyCacheOptions = {},
  ) {
    this.debug = options.debug || false;
    this.timeout = options.timeout || 5 * 60 * 1000; // 5 minutes default
    this.cache = new Map();
    this.stats = {
      size: 0,
      hits: 0,
      misses: 0,
      oldestEntry: null,
      averageAge: 0,
      invalidations: 0,
      errors: 0,
    };
    this.cacheDuration = 0;
  }

  private initializeStats(): void {
    this.stats = {
      size: 0,
      hits: 0,
      misses: 0,
      oldestEntry: null,
      averageAge: 0,
      invalidations: 0,
      errors: 0,
    };
  }

  public async initialize(options: ICacheOperationOptions = {}): Promise<void> {
    this.logDebug("Initializing DependencyCache");

    try {
      if (this.isInitialized) {
        this.logDebug("DependencyCache already initialized");
        return;
      }
      
      if (options.force) {
        this.cache.clear();
        this.logDebug("Forced cache clear during initialization");
      }
      
      if (options.timeout) {
        this.cacheDuration = options.timeout;
        this.logDebug(`Cache timeout set to ${options.timeout}ms`);
      }

      this.cache.clear();
      this.initializeStats();
      this.isInitialized = true;
      this.logDebug("DependencyCache initialization complete");
    } catch (error) {
      throw new CacheError(
        `Failed to initialize cache: ${error instanceof Error ? error.message : String(error)}`,
        "initialize",
      );
    }
  }

  public cleanup(): void {
    this.logDebug("Cleaning up DependencyCache");
    this.cache.clear();
    this.initializeStats();
    this.isInitialized = false;
  }

  private logDebug(message: string): void {
    if (this.debug) {
      this.deps.logger.debug(message);
    }
  }

  private handleError(operation: string, error: unknown, key?: string): never {
    const message = error instanceof Error ? error.message : String(error);
    const cacheError = new CacheError(
      `Cache ${operation} failed: ${message}`,
      operation as "read" | "write" | "delete" | "clear",
      key,
    );
    this.stats.errors++;
    this.deps.logger.error(cacheError.message);
    throw cacheError;
  }

  public get(
    key: string,
    options: ICacheOperationOptions = {},
  ): IDependencyMap | null {
    if (!this.isInitialized) {
      throw new CacheError("Cache not initialized", "read");
    }

    this.logDebug(`Getting cache entry for key: ${key}`);

    try {
      const entry = this.cache.get(key);
      if (!entry) {
        this.stats.misses++;
        this.logDebug(`Cache miss for key: ${key}`);
        return null;
      }

      const age = Date.now() - entry.timestamp;
      if (age > (options.timeout || this.timeout)) {
        this.cache.delete(key);
        this.stats.invalidations++;
        this.stats.misses++;
        this.logDebug(`Cache entry expired for key: ${key}`);
        return null;
      }

      this.stats.hits++;
      this.logDebug(`Cache hit for key: ${key}`);
      return entry.dependencies;
    } catch (error) {
      this.handleError("read", error, key);
    }
  }

  public set(
    key: string,
    dependencies: IDependencyMap,
    options: ICacheOperationOptions = {},
  ): void {
    if (!this.isInitialized) {
      throw new CacheError("Cache not initialized", "write");
    }
    this.logDebug(`Setting cache entry for key: ${key}`);
  
    try {
      const entry: IDependencyCacheEntry = {
        dependencies,
        timestamp: Date.now(),
        hash: this.computeHash(dependencies),
        timeout: options.timeout || this.cacheDuration
      };
  
      if (options.force) {
        this.logDebug(`Force writing cache entry for ${key}`);
        this.cache.set(key, entry);
      } else if (!this.cache.has(key)) {
        this.cache.set(key, entry);
      }
  
      this.updateStats();
      this.logDebug(`Cache entry set for key: ${key}`);
    } catch (error) {
      this.handleError("write", error, key);
    }
  }

  public delete(key: string): void {
    if (!this.isInitialized) {
      throw new CacheError("Cache not initialized", "delete");
    }

    this.logDebug(`Deleting cache entry for key: ${key}`);

    try {
      const deleted = this.cache.delete(key);
      if (deleted) {
        this.updateStats();
        this.logDebug(`Cache entry deleted for key: ${key}`);
      }
    } catch (error) {
      this.handleError("delete", error, key);
    }
  }

  public clear(): void {
    if (!this.isInitialized) {
      throw new CacheError("Cache not initialized", "clear");
    }

    this.logDebug("Clearing cache");

    try {
      this.cache.clear();
      this.initializeStats();
      this.logDebug("Cache cleared");
    } catch (error) {
      this.handleError("clear", error);
    }
  }

  public has(key: string): boolean {
    if (!this.isInitialized) {
      throw new CacheError("Cache not initialized", "read");
    }

    const entry = this.cache.get(key);
    if (!entry) return false;

    const age = Date.now() - entry.timestamp;
    if (age > this.timeout) {
      this.cache.delete(key);
      this.stats.invalidations++;
      return false;
    }

    return true;
  }

  private computeHash(dependencies: IDependencyMap): string {
    return JSON.stringify(dependencies);
  }

  private updateStats(): void {
    const entries = Array.from(this.cache.values());
    let oldestTimestamp = Date.now();
    let totalAge = 0;

    entries.forEach(entry => {
      const age = Date.now() - entry.timestamp;
      oldestTimestamp = Math.min(oldestTimestamp, entry.timestamp);
      totalAge += age;
    });

    this.stats = {
      ...this.stats,
      size: this.cache.size,
      oldestEntry: this.cache.size > 0 ? oldestTimestamp : null,
      averageAge: this.cache.size > 0 ? totalAge / this.cache.size : 0,
    };
  }

  public getStats(): IDependencyCacheStats {
    this.updateStats();
    return { ...this.stats };
  }
}
