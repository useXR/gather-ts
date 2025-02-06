// src/core/tokenization/TokenCache.ts

import crypto from "crypto";
import { FileSystemError, ValidationError, CacheError } from '@/errors';
import { 
  ITokenCache, 
  ICacheEntry, 
  ICacheStats,
  ITokenCacheDeps,
  ITokenCacheOptions 
} from './interfaces/ITokenCache';

export type CacheOperation = 'read' | 'write' | 'delete' | 'clear' | 'expire';

export class TokenCache implements ITokenCache {
  private readonly cachePath: string;
  private readonly projectRoot: string;
  private cache: Record<string, ICacheEntry> = {};
  private readonly maxCacheAge: number;
  private readonly debug: boolean;
  private stats: ICacheStats = {
    totalEntries: 0,
    oldestEntry: null,
    newestEntry: null,
    totalSize: 0,
    hitCount: 0,
    missCount: 0,
    invalidations: 0
  };

  constructor(
    projectRoot: string,
    private readonly deps: ITokenCacheDeps,
    options: ITokenCacheOptions = {}
  ) {
    this.projectRoot = projectRoot;
    this.maxCacheAge = options.maxCacheAge || 7 * 24 * 60 * 60 * 1000; // 7 days default
    this.debug = options.debug || false;
    this.cachePath = this.deps.fileSystem.joinPath(projectRoot, ".deppack", "token-cache.json");
  }

  public async initialize(): Promise<void> {
    this.logDebug('Initializing TokenCache');
    
    try {
      if (!this.deps.fileSystem.exists(this.projectRoot)) {
        throw new ValidationError("Project root does not exist", { projectRoot: this.projectRoot });
      }

      await this.initializeCachePath();
      await this.loadCache();
    } catch (error) {
      throw new CacheError(
        `Failed to initialize TokenCache: ${error instanceof Error ? error.message : String(error)}`,
        'write'
      );
    }
  }

  private async initializeCachePath(): Promise<void> {
    try {
      const cacheDir = this.deps.fileSystem.getDirName(this.cachePath);
      if (!this.deps.fileSystem.exists(cacheDir)) {
        await this.deps.fileSystem.createDirectory(cacheDir, true);
        this.logDebug(`Created cache directory at ${cacheDir}`);
      }
    } catch (error) {
      throw new CacheError(
        `Failed to initialize cache path: ${error instanceof Error ? error.message : String(error)}`,
        'initialize'
      );
    }
  }

  public cleanup(): void {
    this.logDebug('Cleaning up TokenCache');
    this.saveCache();
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
      operation as 'read' | 'write' | 'delete' | 'clear',
      key
    );
    this.deps.logger.error(cacheError.message);
    throw cacheError;
  }

  private validateCacheEntry(entry: unknown): entry is ICacheEntry {
    if (!entry || typeof entry !== "object") {
      return false;
    }

    const candidate = entry as ICacheEntry;
    return (
      typeof candidate.hash === "string" &&
      typeof candidate.tokens === "number" &&
      typeof candidate.lastUpdated === "string" &&
      !isNaN(Date.parse(candidate.lastUpdated))
    );
  }

  private getRelativeCachePath(absolutePath: string): string {
    return this.deps.fileSystem.getRelativePath(this.projectRoot, absolutePath);
  }

  private async loadCache(): Promise<void> {
    try {
      if (this.deps.fileSystem.exists(this.cachePath)) {
        const content = await this.deps.fileSystem.readFile(this.cachePath);
        const parsed = JSON.parse(content);

        if (typeof parsed !== "object" || parsed === null) {
          throw new ValidationError("Invalid cache file structure");
        }

        const validatedCache: Record<string, ICacheEntry> = {};
        const now = Date.now();
        let expiredCount = 0;
        let invalidCount = 0;

        Object.entries(parsed).forEach(([key, entry]) => {
          if (!this.validateCacheEntry(entry)) {
            invalidCount++;
            this.logDebug(`Invalid cache entry for ${key}, skipping`);
            return;
          }

          const entryAge = now - Date.parse(entry.lastUpdated);
          if (entryAge > this.maxCacheAge) {
            expiredCount++;
            this.stats.invalidations++;
            this.logDebug(`Skipping expired cache entry for ${key}`);
            return;
          }

          validatedCache[key] = entry;
        });

        this.cache = validatedCache;
        this.updateStats();
        this.logDebug(
          `Loaded ${Object.keys(this.cache).length} valid cache entries ` +
          `(${expiredCount} expired, ${invalidCount} invalid)`
        );
      }
    } catch (error) {
      this.handleError('read', error);
    }
  }

  private async saveCache(): Promise<void> {
    try {
      await this.deps.fileSystem.writeFile(
        this.cachePath,
        JSON.stringify(this.cache, null, 2)
      );
      this.logDebug(`Saved ${Object.keys(this.cache).length} cache entries`);
    } catch (error) {
      this.handleError('write', error);
    }
  }

  private computeHash(content: string): string {
    try {
      return crypto.createHash("md5").update(content).digest("hex");
    } catch (error) {
      this.handleError('hash', error);
    }
  }

  public getCachedTokenCount(filePath: string, content: string): number | null {
    if (!filePath || typeof filePath !== "string") {
      throw new ValidationError("Invalid file path provided", { filePath });
    }

    try {
      const relativePath = this.getRelativeCachePath(filePath);
      const hash = this.computeHash(content);
      const cached = this.cache[relativePath];

      if (cached && cached.hash === hash) {
        const entryAge = Date.now() - Date.parse(cached.lastUpdated);
        if (entryAge > this.maxCacheAge) {
          this.logDebug(`Cache entry for ${relativePath} has expired`);
          delete this.cache[relativePath];
          this.stats.invalidations++;
          this.stats.missCount++;
          return null;
        }
        this.stats.hitCount++;
        return cached.tokens;
      }
      this.stats.missCount++;
      return null;
    } catch (error) {
      this.handleError('read', error, filePath);
    }
  }

  public cacheTokenCount(filePath: string, content: string, tokens: number): void {
    if (!filePath || typeof filePath !== "string") {
      throw new ValidationError("Invalid file path provided", { filePath });
    }

    if (typeof tokens !== "number" || isNaN(tokens) || tokens < 0) {
      throw new ValidationError("Invalid token count provided", { filePath, tokens });
    }

    try {
      const relativePath = this.getRelativeCachePath(filePath);
      const entry: ICacheEntry = {
        hash: this.computeHash(content),
        tokens,
        lastUpdated: new Date().toISOString()
      };

      this.cache[relativePath] = entry;
      this.updateStats();
      this.saveCache();
      this.logDebug(`Cached ${tokens} tokens for ${relativePath}`);
    } catch (error) {
      this.handleError('write', error, filePath);
    }
  }

  public clear(): void {
    try {
      this.cache = {};
      this.updateStats();
      if (this.deps.fileSystem.exists(this.cachePath)) {
        this.deps.fileSystem.deleteFile(this.cachePath);
        this.logDebug('Cleared cache file');
      }
    } catch (error) {
      this.handleError('clear', error);
    }
  }

  private updateStats(): void {
    const entries = Object.values(this.cache);
    let oldestDate = Date.now();
    let newestDate = 0;

    entries.forEach((entry) => {
      const timestamp = Date.parse(entry.lastUpdated);
      oldestDate = Math.min(oldestDate, timestamp);
      newestDate = Math.max(newestDate, timestamp);
    });

    this.stats.totalEntries = entries.length;
    this.stats.oldestEntry = entries.length > 0 ? new Date(oldestDate).toISOString() : null;
    this.stats.newestEntry = entries.length > 0 ? new Date(newestDate).toISOString() : null;
    this.stats.totalSize = Buffer.byteLength(JSON.stringify(this.cache));
  }

  public getCacheStats(): ICacheStats {
    return { ...this.stats };
  }
}