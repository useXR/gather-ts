// src/core/tokenization/TokenCounter.ts

import { encoding_for_model } from "@dqbd/tiktoken";
import { TokenizationError, ValidationError } from "@/errors";
import {
  ITokenCounter,
  ITokenCounterDeps,
  ITokenCounterOptions,
  ITokenCounterStats,
  ITokenCounterMetrics,
  ITokenizeOptions,
  ITokenizerModelConfig,
} from "./interfaces/ITokenCounter";
import { BaseService } from "@/types/services";
import { IFileWithContent, ISummaryStats, TiktokenModel } from "@/types";

const MODEL_CONFIGS: Record<TiktokenModel, ITokenizerModelConfig> = {
  "gpt-3.5-turbo": { name: "gpt-3.5-turbo", contextLimit: 16384 },
  "gpt-4": { name: "gpt-4", contextLimit: 8192 },
  "gpt-4o": { name: "gpt-4o", contextLimit: 128000 },
  "gpt-4o-mini": { name: "gpt-4o-mini", contextLimit: 128000 },
  o1: { name: "o1", contextLimit: 128000 },
  "o1-mini": { name: "o1-mini", contextLimit: 128000 },
  "o3-mini": { name: "o3-mini", contextLimit: 200000 },
};

export class TokenCounter extends BaseService implements ITokenCounter {
  private encoder: any = null;
  private readonly debug: boolean;
  private readonly batchSize: number;
  private readonly modelOverride?: TiktokenModel;
  private readonly enableCache: boolean;
  private startTime: number;
  private stats: ITokenCounterStats = {
    cacheHits: 0,
    cacheMisses: 0,
    totalTokensCounted: 0,
    totalFilesProcessed: 0,
    totalProcessingTime: 0,
    failedFiles: 0,
    batchesProcessed: 0,
    averageTokensPerFile: 0,
    averageProcessingTime: 0,
  };

  constructor(
    private readonly deps: ITokenCounterDeps,
    options: ITokenCounterOptions = {},
  ) {
    super();
    this.debug = options.debug || false;
    this.batchSize = options.batchSize || 100;
    this.modelOverride = options.modelOverride;
    this.enableCache = options.enableCache ?? true;
    this.startTime = Date.now();
  }

  public override async initialize(): Promise<void> {
    await super.initialize();
    this.logDebug("Initializing TokenCounter");

    try {
      // Initialize encoder
      await this.getEncoder();

      // Initialize cache if provided
      if (this.deps.cache?.initialize) {
        await this.deps.cache.initialize();
      }

      this.startTime = Date.now();
      this.logDebug("TokenCounter initialization complete");
    } catch (error) {
      this.handleError(error, "initialize");
    }
  }

  public override cleanup(): void {
    this.logDebug("Cleaning up TokenCounter");
    try {
      if (this.encoder) {
        this.encoder.free();
        this.encoder = null;
      }
      if (this.deps.cache?.cleanup) {
        this.deps.cache.cleanup();
      }
      super.cleanup();
    } catch (error) {
      this.deps.logger.warn(
        `Cleanup error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private initializeStats(): void {
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      totalTokensCounted: 0,
      totalFilesProcessed: 0,
      totalProcessingTime: 0,
      failedFiles: 0,
      batchesProcessed: 0,
      averageTokensPerFile: 0,
      averageProcessingTime: 0,
    };
  }

  private logDebug(message: string): void {
    if (this.debug) {
      this.deps.logger.debug(message);
    }
  }

  private handleError(
    error: unknown,
    operation: string,
    filePath?: string,
  ): never {
    const message = error instanceof Error ? error.message : String(error);
    const tokenizationError = new TokenizationError(
      `Tokenization ${operation} failed: ${message}`,
      filePath || "unknown",
      operation as "encode" | "decode" | "initialize" | "cleanup",
      this.getCurrentModel(),
    );
    this.deps.logger.error(tokenizationError.message);
    throw tokenizationError;
  }

  private getCurrentModel(): TiktokenModel {
    return (
      this.modelOverride ||
      (this.deps.configManager.getTokenizerModel() as TiktokenModel)
    );
  }

  private async getEncoder() {
    if (!this.encoder) {
      const modelName = this.getCurrentModel();
      const modelConfig = MODEL_CONFIGS[modelName];

      if (!modelConfig) {
        throw new ValidationError("Unsupported tokenizer model", {
          model: modelName,
          supportedModels: Object.keys(MODEL_CONFIGS),
        });
      }

      try {
        this.encoder = await encoding_for_model(modelConfig.name);
        this.logDebug(`Initialized encoder for model: ${modelConfig.name}`);
      } catch (error) {
        this.handleError(error, "initialize");
      }
    }
    return this.encoder;
  }

  public async countTokens(
    filePath: string,
    text: string,
    options: ITokenizeOptions = {},
  ): Promise<number> {
    const startTime = Date.now();

    if (!this.isInitialized) {
      throw new TokenizationError(
        "TokenCounter not initialized",
        filePath,
        "encode",
        this.getCurrentModel(),
      );
    }

    // Handle empty text more gracefully
    if (!text || text.trim() === "") {
      this.logDebug(`Empty content in file: ${filePath}, returning 0 tokens`);
      this.updateStats({
        totalTokensCounted: 0,
        totalFilesProcessed: 1,
        totalProcessingTime: Date.now() - startTime,
        lastProcessedFile: filePath,
      });
      return 0;
    }

    try {
      this.logDebug(`Counting tokens for ${filePath}`);

      // Check cache first if enabled and not explicitly disabled for this operation
      if (this.enableCache && options.useCache !== false && this.deps.cache) {
        const cachedCount = this.deps.cache.getCachedTokenCount(filePath, text);
        if (cachedCount !== null) {
          this.updateStats({
            cacheHits: 1,
            totalTokensCounted: cachedCount,
            totalFilesProcessed: 1,
            totalProcessingTime: Date.now() - startTime,
          });
          this.logDebug(`Cache hit for ${filePath}: ${cachedCount} tokens`);
          return cachedCount;
        }
        this.stats.cacheMisses++;
        this.logDebug(`Cache miss for ${filePath}`);
      }

      const encoder = await this.getEncoder();
      const tokenCount = encoder.encode(text).length;

      // Cache the result if enabled and not explicitly disabled for this operation
      if (this.enableCache && options.useCache !== false && this.deps.cache) {
        try {
          this.deps.cache.cacheTokenCount(filePath, text, tokenCount);
          this.logDebug(`Cached ${tokenCount} tokens for ${filePath}`);
        } catch (error) {
          this.deps.logger.warn(
            `Failed to cache token count for ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      this.updateStats({
        totalTokensCounted: tokenCount,
        totalFilesProcessed: 1,
        totalProcessingTime: Date.now() - startTime,
        lastProcessedFile: filePath,
      });

      this.logDebug(`Counted ${tokenCount} tokens for ${filePath}`);
      return tokenCount;
    } catch (error) {
      this.stats.failedFiles++;
      this.stats.lastError =
        error instanceof Error ? error : new Error(String(error));
      this.handleError(error, "encode", filePath);
    }
  }

  private updateStats(update: Partial<ITokenCounterStats>): void {
    Object.assign(this.stats, update);

    if (this.stats.totalFilesProcessed > 0) {
      this.stats.averageTokensPerFile =
        this.stats.totalTokensCounted / this.stats.totalFilesProcessed;
      this.stats.averageProcessingTime =
        this.stats.totalProcessingTime / this.stats.totalFilesProcessed;
    }
  }

  public async generateSummary(
    files: IFileWithContent[],
  ): Promise<ISummaryStats> {
    this.logDebug(`Generating summary for ${files.length} files`);

    if (!files.length) {
      throw new ValidationError("No files provided for summary generation");
    }

    const results = await this.processBatch(files);
    const fileStats = results.map(result => ({
      path: result.file,
      chars: files.find(f => f.path === result.file)?.content.length || 0,
      tokens: result.tokens,
    }));

    const topFilesCount = this.deps.configManager.getTopFilesCount();
    const topFiles = [...fileStats]
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, topFilesCount);

    const totalStats = fileStats.reduce(
      (acc, file) => ({
        chars: acc.chars + file.chars,
        tokens: acc.tokens + file.tokens,
      }),
      { chars: 0, tokens: 0 },
    );

    const tokenValues = fileStats.map(stat => stat.tokens);
    const averageTokens = totalStats.tokens / fileStats.length;
    const maxTokens = Math.max(...tokenValues);
    const minTokens = Math.min(...tokenValues);

    this.logDebug(`Summary generated: ${totalStats.tokens} total tokens`);

    return {
      totalFiles: fileStats.length,
      totalChars: totalStats.chars,
      totalTokens: totalStats.tokens,
      topFiles,
      generationTime: new Date().toISOString(),
      averageTokensPerFile: averageTokens,
      maxTokensInFile: maxTokens,
      minTokensInFile: minTokens,
    };
  }

  public async processBatch(
    files: IFileWithContent[],
    batchSize: number = this.batchSize,
  ): Promise<Array<{ file: string; tokens: number }>> {
    this.logDebug(`Processing batch of ${files.length} files`);

    const results: Array<{ file: string; tokens: number }> = [];

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async file => ({
          file: file.path,
          tokens: await this.countTokens(file.path, file.content),
        })),
      );
      results.push(...batchResults);
      this.stats.batchesProcessed++;

      const progress = Math.floor(((i + batch.length) / files.length) * 100);
      this.logDebug(
        `Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(files.length / batchSize)} (${progress}%)`,
      );
    }

    return results;
  }

  public getStats(): ITokenCounterStats {
    return { ...this.stats };
  }

  public getMetrics(): ITokenCounterMetrics {
    const uptime = Date.now() - this.startTime;
    const totalHits = this.stats.cacheHits + this.stats.cacheMisses;

    return {
      tokensPerSecond: this.stats.totalTokensCounted / (uptime / 1000),
      filesPerSecond: this.stats.totalFilesProcessed / (uptime / 1000),
      cacheHitRate: totalHits > 0 ? this.stats.cacheHits / totalHits : 0,
      averageFileSize:
        this.stats.totalTokensCounted / this.stats.totalFilesProcessed,
      peakMemoryUsage: process.memoryUsage().heapUsed,
      currentTokenizerModel: this.getCurrentModel(),
    };
  }

  public resetStats(): void {
    this.logDebug("Resetting stats");
    this.initializeStats();
    this.startTime = Date.now();
  }

  public generateSummaryText(stats: ISummaryStats): string {
    this.logDebug("Generating summary text");

    const config = this.deps.configManager.getConfig();
    const summary: string[] = [];

    if (config.outputFormat.includeSummaryInFile) {
      summary.push(
        "================================================================",
        "Token Analysis Summary",
        "================================================================\n",
      );

      if (config.outputFormat.includeGenerationTime) {
        summary.push(`Generated on: ${stats.generationTime}\n`);
      }

      summary.push("Top Files by Token Usage:", "------------------------");

      stats.topFiles.forEach((file, index) => {
        summary.push(
          `${index + 1}. ${file.path}`,
          `   ${file.chars.toLocaleString()} characters, ${file.tokens.toLocaleString()} tokens`,
        );
      });

      summary.push(
        "\nOverall Statistics:",
        "------------------",
        `Total Files: ${stats.totalFiles}`,
        `Total Characters: ${stats.totalChars.toLocaleString()}`,
        `Total Tokens: ${stats.totalTokens.toLocaleString()}`,
        `Average Tokens Per File: ${stats.averageTokensPerFile?.toFixed(2) ?? "N/A"}`,
        `Maximum Tokens in a File: ${stats.maxTokensInFile?.toLocaleString() ?? "N/A"}`,
        `Minimum Tokens in a File: ${stats.minTokensInFile?.toLocaleString() ?? "N/A"}`,
      );

      const metrics = this.getMetrics();
      summary.push(
        "\nPerformance Metrics:",
        "-------------------",
        `Processing Speed: ${metrics.tokensPerSecond.toFixed(2)} tokens/sec`,
        `Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`,
        `Peak Memory Usage: ${(metrics.peakMemoryUsage / 1024 / 1024).toFixed(2)} MB`,
      );
    }

    return summary.join("\n");
  }

  public printSummary(stats: ISummaryStats, outputFile: string): void {
    this.logDebug("Printing summary");

    if (!stats || typeof stats !== "object") {
      throw new ValidationError("Invalid stats object provided");
    }

    this.deps.logger.success("\nToken analysis completed!");

    this.deps.logger.info(
      `\nTop ${stats.topFiles.length} Files by Token Usage:`,
    );
    this.deps.logger.info(
      "──────────────────────────────────────────────────────",
    );

    stats.topFiles.forEach((file, index) => {
      const formattedPath = file.path.padEnd(45);
      this.deps.logger.info(
        `${(index + 1).toString().padStart(2)}. ${formattedPath}` +
          `(${file.chars.toString().padStart(6)} chars, ${file.tokens.toString().padStart(6)} tokens)`,
      );
    });

    const metrics = this.getMetrics();

    this.deps.logger.info("\n📊 Analysis Summary:");
    this.deps.logger.info("────────────────");
    this.deps.logger.info(`Total Files: ${stats.totalFiles}`);
    this.deps.logger.info(`Total Chars: ${stats.totalChars.toLocaleString()}`);
    this.deps.logger.info(
      `Total Tokens: ${stats.totalTokens.toLocaleString()}`,
    );
    this.deps.logger.info(
      `Avg Tokens/File: ${stats.averageTokensPerFile?.toFixed(2) ?? "N/A"}`,
    );
    this.deps.logger.info(
      `Processing Speed: ${metrics.tokensPerSecond.toFixed(2)} tokens/sec`,
    );
    this.deps.logger.info(
      `Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`,
    );
    this.deps.logger.info(`Output File: ${outputFile}`);

    // Check token limit warning
    const warning = this.deps.configManager.getTokenWarning(stats.totalTokens);
    if (warning) {
      this.deps.logger.warn(`\n${warning}`);
    }
  }
}
