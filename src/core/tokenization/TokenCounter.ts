import { encoding_for_model } from "@dqbd/tiktoken";
import { IConfigManager } from "@/config/interfaces/IConfigManager";
import { TokenCacheManager } from "./TokenCache";
import { logger } from "@/utils/logging";
import { TokenizationError, ValidationError } from "@/errors";
import { errorUtils } from "@/errors";
import { ITokenCounter, ITokenCounterOptions } from "./interfaces/ITokenCounter";
import { TiktokenModel, IModelConfig } from "@/types/models/tokenizer";
import { IFileStats, IFileWithContent } from "@/types/files";
import { ISummaryStats } from "@/types/stats";

const MODEL_CONFIGS: Record<string, IModelConfig> = {
  "gpt-3.5-turbo": { name: "gpt-3.5-turbo", contextLimit: 16384 },
  "gpt-4": { name: "gpt-4", contextLimit: 8192 },
  "gpt-4o": { name: "gpt-4o", contextLimit: 128000 },
  "gpt-4o-mini": { name: "gpt-4o-mini", contextLimit: 128000 },
  "o1": { name: "o1", contextLimit: 128000 },
  "o1-mini": { name: "o1-mini", contextLimit: 128000 },
  "o3-mini": { name: "o3-mini", contextLimit: 200000 },
};

export class TokenCounter implements ITokenCounter {
  private encoder: any = null;
  private readonly configManager: IConfigManager;
  private readonly cacheManager: TokenCacheManager | null = null;

  constructor(
    configManager: IConfigManager, 
    options: ITokenCounterOptions = {}
  ) {
    this.configManager = configManager;
    if (configManager.getConfig().cacheTokenCounts) {
      try {
        this.cacheManager = new TokenCacheManager(configManager.getProjectRoot());
      } catch (error) {
        logger.warn(
          `Failed to initialize token cache: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  private async getEncoder() {
    if (!this.encoder) {
      const configModel = this.configManager.getTokenizerModel();
      const modelConfig = MODEL_CONFIGS[configModel];

      if (!modelConfig) {
        throw new ValidationError("Unsupported tokenizer model", {
          model: configModel,
          supportedModels: Object.keys(MODEL_CONFIGS),
        });
      }

      try {
        this.encoder = await encoding_for_model(modelConfig.name);
      } catch (error) {
        throw new TokenizationError(
          `Failed to initialize tokenizer: ${error instanceof Error ? error.message : String(error)}`,
          this.configManager.getProjectRoot(),
          'initialize'
        );
      }
    }
    return this.encoder;
  }

  public async countTokens(filePath: string, text: string): Promise<number> {
    if (!text) {
      throw new ValidationError("Empty text provided for tokenization", { filePath });
    }

    // Check cache first if enabled
    if (this.cacheManager) {
      try {
        const cachedCount = this.cacheManager.getCachedTokenCount(filePath, text);
        if (cachedCount !== null) {
          return cachedCount;
        }
      } catch (error) {
        logger.warn(
          `Cache lookup failed for ${filePath}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    try {
      const encoder = await this.getEncoder();
      const tokenCount = encoder.encode(text).length;

      // Cache the result if enabled
      if (this.cacheManager) {
        try {
          this.cacheManager.cacheTokenCount(filePath, text, tokenCount);
        } catch (error) {
          logger.warn(
            `Failed to cache token count for ${filePath}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      return tokenCount;
    } catch (error) {
      throw new TokenizationError(
        `Failed to count tokens: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        'encode',
        this.configManager.getTokenizerModel()
      );
    }
  }

  public async generateSummary(filesWithContent: IFileWithContent[]): Promise<ISummaryStats> {
    if (!Array.isArray(filesWithContent) || filesWithContent.length === 0) {
      throw new ValidationError("No files provided for summary generation");
    }

    const fileStats = await Promise.all(
      filesWithContent.map(async (file) => {
        try {
          return {
            path: file.path,
            chars: file.content.length,
            tokens: await this.countTokens(file.path, file.content),
          } as IFileStats;
        } catch (error) {
          logger.error(
            `Failed to process ${file.path}: ${error instanceof Error ? error.message : String(error)}`
          );
          return {
            path: file.path,
            chars: 0,
            tokens: 0,
          } as IFileStats;
        }
      })
    );

    const topFilesCount = this.configManager.getTopFilesCount();
    const topFiles = [...fileStats]
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, topFilesCount);

    const totalStats = fileStats.reduce(
      (acc, file) => ({
        chars: acc.chars + file.chars,
        tokens: acc.tokens + file.tokens,
      }),
      { chars: 0, tokens: 0 }
    );

    const tokenValues = fileStats.map(stat => stat.tokens);
    const averageTokens = totalStats.tokens / fileStats.length;
    const maxTokens = Math.max(...tokenValues);
    const minTokens = Math.min(...tokenValues);

    return {
      totalFiles: fileStats.length,
      totalChars: totalStats.chars,
      totalTokens: totalStats.tokens,
      topFiles,
      generationTime: new Date().toISOString(),
      averageTokensPerFile: averageTokens,
      maxTokensInFile: maxTokens,
      minTokensInFile: minTokens
    };
  }

  public generateSummaryText(stats: ISummaryStats): string {
    if (!stats || typeof stats !== "object") {
      throw new ValidationError("Invalid stats object provided");
    }

    try {
      const config = this.configManager.getConfig();
      const summary: string[] = [];

      if (config.outputFormat.includeSummaryInFile) {
        summary.push(
          "================================================================",
          "File Summary",
          "================================================================\n"
        );

        if (config.outputFormat.includeGenerationTime) {
          summary.push(`Generated on: ${stats.generationTime}\n`);
        }

        summary.push("Top Files by Token Usage:", "------------------------");

        stats.topFiles.forEach((file, index) => {
          summary.push(
            `${index + 1}. ${file.path}`,
            `   ${file.chars.toLocaleString()} characters, ${file.tokens.toLocaleString()} tokens`
          );
        });

        summary.push(
          "\nOverall Statistics:",
          "------------------",
          `Total Files: ${stats.totalFiles}`,
          `Total Characters: ${stats.totalChars.toLocaleString()}`,
          `Total Tokens: ${stats.totalTokens.toLocaleString()}`,
          `Average Tokens Per File: ${stats.averageTokensPerFile?.toFixed(2) ?? 'N/A'}`,
          `Maximum Tokens in a File: ${stats.maxTokensInFile?.toLocaleString() ?? 'N/A'}`,
          `Minimum Tokens in a File: ${stats.minTokensInFile?.toLocaleString() ?? 'N/A'}`,
          `Tokenizer Model: ${this.configManager.getTokenizerModel()}\n`
        );

        if (config.outputFormat.includeUsageGuidelines) {
          summary.push(
            "Usage Guidelines:",
            "----------------",
            "- This file is auto-generated and should be treated as read-only",
            '- Use the "File:" markers to locate specific content',
            "- Token counts are calculated using the official tokenizer\n"
          );
        }
      }

      return summary.join("\n");
    } catch (error) {
      throw errorUtils.wrapError(error, "Failed to generate summary text");
    }
  }

  public printSummary(stats: ISummaryStats, outputFile: string): void {
    if (!stats || typeof stats !== "object") {
      throw new ValidationError("Invalid stats object provided");
    }

    if (!outputFile) {
      throw new ValidationError("Output file path not provided");
    }

    try {
      logger.success("\nPacking completed successfully!");
      
      logger.info(`\nTop ${stats.topFiles.length} Files by Token Usage:`);
      logger.info("──────────────────────────────────────────────────────");

      stats.topFiles.forEach((file, index) => {
        const formattedPath = file.path.padEnd(45);
        logger.info(
          `${(index + 1).toString().padStart(2)}. ${formattedPath}` +
          `(${file.chars.toString().padStart(6)} chars, ${file.tokens.toString().padStart(6)} tokens)`
        );
      });

      logger.info("\n📊 Pack Summary:");
      logger.info("────────────────");
      logger.info(`  Total Files: ${stats.totalFiles}`);
      logger.info(`  Total Chars: ${stats.totalChars.toLocaleString()}`);
      logger.info(` Total Tokens: ${stats.totalTokens.toLocaleString()}`);
      logger.info(`    Average Tokens: ${stats.averageTokensPerFile?.toFixed(2) ?? 'N/A'}`);
      logger.info(`     Max Tokens: ${stats.maxTokensInFile?.toLocaleString() ?? 'N/A'}`);
      logger.info(`     Min Tokens: ${stats.minTokensInFile?.toLocaleString() ?? 'N/A'}`);
      logger.info(`    Tokenizer: ${this.configManager.getTokenizerModel()}`);
      logger.info(`       Output: ${outputFile}`);

      const warning = this.configManager.getTokenWarning(stats.totalTokens);
      if (warning) {
        logger.warn(`\n${warning}`);
      }

      logger.success("\n🎉 All Done!");
    } catch (error) {
      throw errorUtils.wrapError(error, "Failed to print summary");
    }
  }

  public cleanup(): void {
    if (this.encoder) {
      try {
        this.encoder.free();
      } catch (error) {
        logger.warn(
          `Failed to cleanup encoder: ${error instanceof Error ? error.message : String(error)}`
        );
      } finally {
        this.encoder = null;
      }
    }
  }
}