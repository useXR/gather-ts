// src/core/tokenization/interfaces/ITokenCache.ts

import { ILogger } from "@/utils";
import { IFileSystem } from "@/utils/filesystem/interfaces/IFileSystem";
import { IService } from "@/types/services";

export interface ICacheEntry {
  hash: string;
  tokens: number;
  lastUpdated: string;
}

export interface ITokenCacheDeps {
  fileSystem: IFileSystem;
  logger: ILogger;
}

export interface ITokenCacheOptions {
  maxCacheAge?: number;
  debug?: boolean;
}

export interface ITokenCache extends IService {
  getCachedTokenCount(filePath: string, content: string): number | null;
  cacheTokenCount(filePath: string, content: string, tokens: number): void;
  clear(): void;
  getCacheStats(): ICacheStats;
}

export interface ICacheStats {
  totalEntries: number;
  oldestEntry: string | null;
  newestEntry: string | null;
  totalSize: number;
  hitCount: number;
  missCount: number;
  invalidations: number;
}