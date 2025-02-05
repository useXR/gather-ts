import crypto from "crypto";
import { FileSystemError, ValidationError, ConfigurationError } from "@/errors";
import { logger } from "@/utils/logging";
import { ITokenCache, ICacheEntry, ICacheStats } from "./interfaces/ITokenCounter";
import { IFileSystem } from "@/utils/filesystem/interfaces/IFileSystem";
import { fileSystem as defaultFileSystem } from "@/utils/filesystem/FileSystem";

export class TokenCacheManager implements ITokenCache {
  private readonly cachePath: string;
  private readonly projectRoot: string;
  private cache: Record<string, ICacheEntry> = {};
  private readonly maxCacheAge: number = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  private readonly fileSystem: IFileSystem;

  constructor(projectRoot: string, fileSystem: IFileSystem = defaultFileSystem) {
    this.fileSystem = fileSystem;
    this.projectRoot = projectRoot;

    if (!projectRoot || typeof projectRoot !== "string") {
      throw new ValidationError("Invalid project root provided", {
        projectRoot,
      });
    }

    try {
      if (!this.fileSystem.exists(projectRoot)) {
        throw new ValidationError("Project root does not exist", {
          projectRoot,
        });
      }

      const cacheDir = this.fileSystem.joinPath(projectRoot, ".deppack");
      const cachePath = this.fileSystem.joinPath(cacheDir, "token-cache.json");
      
      if (!this.fileSystem.exists(cacheDir)) {
        try {
          this.fileSystem.createDirectory(cacheDir, true);
          logger.debug(`Created cache directory at ${cacheDir}`);
        } catch (error) {
          throw new FileSystemError(
            `Failed to create cache directory: ${error instanceof Error ? error.message : String(error)}`,
            cacheDir,
            "create"
          );
        }
      }

      this.cachePath = cachePath;
      this.loadCache();
    } catch (error) {
      if (error instanceof ValidationError || error instanceof FileSystemError) {
        throw error;
      }
      throw new ConfigurationError(
        `Failed to initialize token cache: ${error instanceof Error ? error.message : String(error)}`,
        this.projectRoot
      );
    }
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
    return this.fileSystem.getRelativePath(this.projectRoot, absolutePath);
  }

  private loadCache(): void {
    try {
      if (this.fileSystem.exists(this.cachePath)) {
        const content = this.fileSystem.readFileSync(this.cachePath, 'utf8');
        const parsed = JSON.parse(content);

        if (typeof parsed !== "object" || parsed === null) {
          throw new ValidationError("Invalid cache file structure");
        }

        const validatedCache: Record<string, ICacheEntry> = {};
        const now = Date.now();
        let expiredCount = 0;
        let invalidCount = 0;

        Object.entries(parsed).forEach(([key, entry]) => {
          try {
            if (!this.validateCacheEntry(entry)) {
              invalidCount++;
              logger.debug(`Invalid cache entry for ${key}, skipping`);
              return;
            }

            const entryAge = now - Date.parse(entry.lastUpdated);
            if (entryAge > this.maxCacheAge) {
              expiredCount++;
              logger.debug(`Skipping expired cache entry for ${key}`);
              return;
            }

            validatedCache[key] = entry;
          } catch (error) {
            logger.warn(
              `Error processing cache entry for ${key}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        });

        this.cache = validatedCache;
        logger.debug(
          `Loaded ${Object.keys(this.cache).length} valid cache entries ` +
          `(${expiredCount} expired, ${invalidCount} invalid)`
        );
      }
    } catch (error) {
      throw new FileSystemError(
        `Failed to load cache from ${this.cachePath}: ${error instanceof Error ? error.message : String(error)}`,
        this.cachePath,
        "read"
      );
    }
  }

  private saveCache(): void {
    try {
      const cacheDir = this.fileSystem.getDirName(this.cachePath);

      if (!this.fileSystem.exists(cacheDir)) {
        this.fileSystem.createDirectory(cacheDir, true);
      }

      this.fileSystem.writeFileSync(
        this.cachePath,
        JSON.stringify(this.cache, null, 2),
        { encoding: 'utf8' }
      );
      logger.debug(`Saved ${Object.keys(this.cache).length} cache entries to ${this.cachePath}`);
    } catch (error) {
      throw new FileSystemError(
        `Failed to save cache to ${this.cachePath}: ${error instanceof Error ? error.message : String(error)}`,
        this.cachePath,
        "write"
      );
    }
  }

  private computeHash(content: string): string {
    try {
      return crypto.createHash("md5").update(content).digest("hex");
    } catch (error) {
      throw new ValidationError(
        `Failed to compute content hash: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  public getCachedTokenCount(filePath: string, content: string): number | null {
    if (!filePath || typeof filePath !== "string") {
      throw new ValidationError("Invalid file path provided", { filePath });
    }

    if (typeof content !== "string") {
      throw new ValidationError("Invalid content provided", { filePath });
    }

    try {
      // Convert absolute path to relative for cache key
      const relativePath = this.getRelativeCachePath(filePath);
      const hash = this.computeHash(content);
      const cached = this.cache[relativePath];

      if (cached && cached.hash === hash) {
        const entryAge = Date.now() - Date.parse(cached.lastUpdated);
        if (entryAge > this.maxCacheAge) {
          logger.debug(`Cache entry for ${relativePath} has expired`);
          delete this.cache[relativePath];
          return null;
        }
        return cached.tokens;
      }
      return null;
    } catch (error) {
      throw new ValidationError(
        `Failed to get cached token count: ${error instanceof Error ? error.message : String(error)}`,
        { filePath }
      );
    }
  }

  public cacheTokenCount(filePath: string, content: string, tokens: number): void {
    if (!filePath || typeof filePath !== "string") {
      throw new ValidationError("Invalid file path provided", { filePath });
    }

    if (typeof content !== "string") {
      throw new ValidationError("Invalid content provided", { filePath });
    }

    if (typeof tokens !== "number" || isNaN(tokens) || tokens < 0) {
      throw new ValidationError("Invalid token count provided", {
        filePath,
        tokens,
      });
    }

    try {
      const relativePath = this.getRelativeCachePath(filePath);
      const entry: ICacheEntry = {
        hash: this.computeHash(content),
        tokens,
        lastUpdated: new Date().toISOString(),
      };

      this.cache[relativePath] = entry;
      this.saveCache();
      logger.debug(`Cached ${tokens} tokens for ${relativePath}`);
    } catch (error) {
      throw new ValidationError(
        `Failed to cache token count: ${error instanceof Error ? error.message : String(error)}`,
        { filePath, tokens }
      );
    }
  }

  public clear(): void {
    try {
      this.cache = {};
      if (this.fileSystem.exists(this.cachePath)) {
        this.fileSystem.deleteFile(this.cachePath);
        logger.debug(`Cleared cache file at ${this.cachePath}`);
      }
    } catch (error) {
      throw new FileSystemError(
        `Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`,
        this.cachePath,
        "delete"
      );
    }
  }

  public getCacheStats(): ICacheStats {
    try {
      const entries = Object.values(this.cache);
      let oldestDate = Date.now();
      let newestDate = 0;

      entries.forEach((entry) => {
        const timestamp = Date.parse(entry.lastUpdated);
        oldestDate = Math.min(oldestDate, timestamp);
        newestDate = Math.max(newestDate, timestamp);
      });

      const stats: ICacheStats = {
        totalEntries: entries.length,
        oldestEntry: entries.length > 0 ? new Date(oldestDate).toISOString() : null,
        newestEntry: entries.length > 0 ? new Date(newestDate).toISOString() : null,
        totalSize: Buffer.byteLength(JSON.stringify(this.cache)),
      };

      return stats;
    } catch (error) {
      throw new ValidationError(
        `Failed to generate cache statistics: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}