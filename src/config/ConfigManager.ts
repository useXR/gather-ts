import { logger } from "@/utils/logging";
import { fileSystem } from "@/utils/filesystem/FileSystem";
import { ConfigurationError, FileSystemError, ValidationError } from "@/errors";
import { IConfigLoadResult, IDeppackConfig } from "@/types/config";
import { TiktokenModel } from "@/types/models/tokenizer";
import { 
  IConfigManager, 
  IConfigLoader, 
  IConfigManagerOptions,
  IConfigManagerStatic,
} from "./interfaces/IConfigManager";
import { ConfigValidator } from "./validators/ConfigValidator";
import { IFileSystem } from "@/utils/filesystem/interfaces/IFileSystem";

const defaultConfig: IDeppackConfig = {
  topFilesCount: 5,
  showTokenCount: true,
  tokenizer: {
    model: "gpt-4",
    showWarning: true,
  },
  outputFormat: {
    includeSummaryInFile: true,
    includeGenerationTime: true,
    includeUsageGuidelines: true,
  },
};

export class ConfigManager implements IConfigManager, IConfigLoader {
  private config: IDeppackConfig;
  private readonly configPath: string;
  private readonly projectRoot: string;
  private readonly validator: ConfigValidator;
  private readonly fs: IFileSystem;

  constructor(projectRoot: string, options: IConfigManagerOptions = {}) {
    this.fs = options.fileSystem || fileSystem;
    
    if (!this.fs.exists(projectRoot)) {
      throw new ValidationError("Project root directory does not exist", {
        projectRoot,
      });
    }

    this.projectRoot = projectRoot;
    this.configPath = options.configPath || 
      this.fs.joinPath(projectRoot, "deppack.config.json");
    this.validator = new ConfigValidator();
    
    if (options.debug) {
      logger.debug(`Looking for config at: ${this.configPath}`);
    }
    
    this.config = this.loadConfig();
  }

  public loadConfig(overrides?: Partial<IDeppackConfig>): IDeppackConfig {
    let fileConfig: Partial<IDeppackConfig> = {};
    let loadResult: IConfigLoadResult = {
      config: defaultConfig,
      source: 'default',
      validation: { isValid: true, errors: [], warnings: [] }
    };

    try {
      if (this.fs.exists(this.configPath)) {
        try {
          const configContent = this.fs.readFileSync(this.configPath, 'utf8');
          fileConfig = JSON.parse(configContent);
          logger.info("Loaded configuration from deppack.config.json");
          loadResult.source = 'file';
        } catch (error) {
          if (error instanceof SyntaxError) {
            throw new ConfigurationError(
              "Invalid JSON in config file",
              this.configPath
            );
          }
          throw new FileSystemError(
            error instanceof Error ? error.message : "Unknown error",
            this.configPath,
            "read"
          );
        }
      } else {
        logger.warn("No deppack.config.json found, using defaults");
      }
    } catch (error) {
      if (error instanceof ConfigurationError || error instanceof FileSystemError) {
        throw error;
      }
      throw new ConfigurationError(
        `Failed to load configuration: ${
          error instanceof Error ? error.message : String(error)
        }`,
        this.configPath
      );
    }

    const mergedConfig = {
      ...defaultConfig,
      ...fileConfig,
      ...overrides,
    };

    try {
      loadResult.validation = this.validator.validateAll(mergedConfig);
      if (!loadResult.validation.isValid) {
        throw new ConfigurationError(
          `Configuration validation failed: ${loadResult.validation.errors.join(', ')}`,
          this.configPath
        );
      }

      // Log any warnings
      loadResult.validation.warnings.forEach(warning => {
        logger.warn(`Configuration warning: ${warning}`);
      });

    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ConfigurationError(
          `Configuration validation failed: ${error.message}`,
          this.configPath
        );
      }
      throw error;
    }

    loadResult.config = mergedConfig as IDeppackConfig;
    return loadResult.config;
  }

  public getProjectRoot(): string {
    return this.projectRoot;
  }

  public getConfig(): IDeppackConfig {
    return { ...this.config };
  }

  public getTokenizerModel(): string {
    return this.config.tokenizer.model;
  }

  public getMaxDepth(): number | undefined {
    return this.config.maxDepth;
  }

  public shouldShowTokenCount(): boolean {
    return this.config.showTokenCount;
  }

  public getTopFilesCount(): number {
    return this.config.topFilesCount;
  }

  public isDebugEnabled(): boolean {
    return this.config.debug ?? false;
  }

  public getModelTokenLimit(): number {
    const limits: Record<TiktokenModel, number> = {
      "gpt-3.5-turbo": 16384,
      "gpt-4": 8192,
      "gpt-4o": 128000,
      "gpt-4o-mini": 128000,
      o1: 128000,
      "o1-mini": 128000,
      "o3-mini": 200000,
    };

    const limit = limits[this.config.tokenizer.model];
    if (!limit) {
      throw new ConfigurationError(
        `Unsupported model: ${this.config.tokenizer.model}`,
        this.configPath
      );
    }

    return limit;
  }

  public getTokenWarning(totalTokens: number): string | null {
    if (!this.config.tokenizer.showWarning) return null;

    const limit = this.getModelTokenLimit();
    if (totalTokens > limit) {
      return `Total tokens (${totalTokens}) exceed ${this.config.tokenizer.model}'s context limit of ${limit}`;
    }
    return null;
  }

  public static generateDefaultConfig(outputPath: string): void {
    try {
      const fs = fileSystem;
      const config: IDeppackConfig = {
        ...defaultConfig,
        debug: false,
        cacheTokenCounts: true,
        maxDepth: 5,
      };

      // Ensure directory exists
      const outputDir = fs.getDirName(outputPath);
      if (!fs.exists(outputDir)) {
        fs.createDirectory(outputDir, true);
      }

      fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), { encoding: 'utf8' });
      logger.success(`Generated default config at ${outputPath}`);
    } catch (error) {
      if (error instanceof Error) {
        throw new FileSystemError(error.message, outputPath, "write");
      }
      throw new ConfigurationError(
        `Failed to generate default configuration: ${String(error)}`,
        outputPath
      );
    }
  }
}

// Ensure the static interface is implemented
export const ConfigManagerStatic: IConfigManagerStatic = ConfigManager;