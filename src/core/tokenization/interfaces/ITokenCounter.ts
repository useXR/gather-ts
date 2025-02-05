import { IFileWithContent } from '@/types/files';
import { ISummaryStats } from '@/types/stats';
import { ITokenizationResult } from '@/types/models/tokenizer';

export interface ITokenCounter {
  countTokens(filePath: string, text: string): Promise<number>;
  generateSummary(filesWithContent: IFileWithContent[]): Promise<ISummaryStats>;
  generateSummaryText(stats: ISummaryStats): string;
  printSummary(stats: ISummaryStats, outputFile: string): void;
  cleanup(): void;
}

export interface ITokenCache {
  getCachedTokenCount(filePath: string, content: string): number | null;
  cacheTokenCount(filePath: string, content: string, tokens: number): void;
  clear(): void;
  getCacheStats(): ICacheStats;
}

export interface ICacheEntry {
  hash: string;
  tokens: number;
  lastUpdated: string;
}

export interface ICacheStats {
  totalEntries: number;
  oldestEntry: string | null;
  newestEntry: string | null;
  totalSize: number;
}

export interface ITokenCounterOptions {
  enableCache?: boolean;
  debug?: boolean;
  maxCacheAge?: number;
}