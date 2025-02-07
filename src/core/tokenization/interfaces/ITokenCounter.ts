// src/core/tokenization/interfaces/ITokenCounter.ts

import { IFileWithContent } from "@/types/files";
import { ISummaryStats } from "@/types/stats";
import { IConfigManager } from "@/config";
import { IFileSystem } from "@/utils/filesystem/interfaces/IFileSystem";
import { ILogger } from "@/utils/logging/interfaces/ILogger";
import { IService } from "@/types/services";
import { TiktokenModel } from "@/types/models/tokenizer";
import { ITokenCache } from "./ITokenCache";

export interface ITokenCounterStats {
  cacheHits: number;
  cacheMisses: number;
  totalTokensCounted: number;
  totalFilesProcessed: number;
  totalProcessingTime: number;
  failedFiles: number;
  batchesProcessed: number;
  averageTokensPerFile: number;
  averageProcessingTime: number;
  lastProcessedFile?: string;
  lastError?: Error;
}

export interface ITokenCounterMetrics {
  tokensPerSecond: number;
  filesPerSecond: number;
  cacheHitRate: number;
  averageFileSize: number;
  peakMemoryUsage: number;
  currentTokenizerModel: TiktokenModel;
}

export interface ITokenizerModelConfig {
  name: TiktokenModel;
  contextLimit: number;
}

export interface ITokenCounterDeps {
  configManager: IConfigManager;
  fileSystem: IFileSystem;
  logger: ILogger;
  cache?: ITokenCache;
}

export interface ITokenCounterOptions {
  debug?: boolean;
  maxCacheAge?: number;
  enableCache?: boolean;
  batchSize?: number;
  modelOverride?: TiktokenModel;
}

export interface ITokenizeOptions {
  useCache?: boolean;
  modelOverride?: TiktokenModel;
}

export interface ITokenCounter extends IService {
  countTokens(filePath: string, text: string): Promise<number>;
  generateSummary(filesWithContent: IFileWithContent[]): Promise<ISummaryStats>;
  generateSummaryText(stats: ISummaryStats): string;
  printSummary(stats: ISummaryStats, outputFile: string): void;
  processBatch(
    files: IFileWithContent[],
    batchSize?: number,
  ): Promise<Array<{ file: string; tokens: number }>>;
  getStats(): ITokenCounterStats;
  getMetrics(): ITokenCounterMetrics;
  resetStats(): void;
}
