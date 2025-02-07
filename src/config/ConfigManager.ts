// src/config/ConfigManager.ts

import { EventEmitter } from "events";
import { ConfigurationError, ValidationError } from "@/errors";
import {
  IConfigManager,
  IConfigManagerDeps,
  IConfigManagerOptions,
  IConfigChangeEvent,
  IConfigLoadOptions,
  IConfigMetrics,
} from "./interfaces/IConfigManager";
import { IGatherTSConfig as IGatherTSConfig, IConfigValidationResult } from "@/types/config";
import { TiktokenModel } from "@/types/models/tokenizer";
import { BaseService } from "@/types/services";

// Create a class that extends EventEmitter and implements needed methods
class EventEmitterBase extends EventEmitter {
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  emit(event: string | symbol, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }

  removeAllListeners(event?: string | symbol): this {
    return super.removeAllListeners(event);
  }
}

const defaultConfig: IGatherTSConfig = {
  maxDepth: 5,
  topFilesCount: 5,
  showTokenCount: true,
  tokenizer: {
    model: "gpt-4" as TiktokenModel,
    showWarning: true,
  },
  outputFormat: {
    includeSummaryInFile: true,
    includeGenerationTime: true,
    includeUsageGuidelines: true,
  },
  debug: false,
  cacheTokenCounts: true,
};

export class ConfigManager extends BaseService implements IConfigManager {
  private eventEmitter: EventEmitterBase;
  private config: IGatherTSConfig;
  private readonly configPath: string;
  private readonly projectRoot: string;
  private readonly debug: boolean;
  private readonly watch: boolean;
  private watchHandler?: NodeJS.Timeout;
  private metrics: IConfigMetrics = {
    loads: 0,
    updates: 0,
    validationErrors: 0,
    lastUpdate: undefined,
  };

  constructor(
    projectRoot: string,
    private readonly deps: IConfigManagerDeps,
    options: IConfigManagerOptions = {},
  ) {
    super();
    this.eventEmitter = new EventEmitterBase();

    if (!projectRoot || !this.deps.fileSystem.exists(projectRoot)) {
      throw new ConfigurationError(
        "Project root directory does not exist",
        projectRoot,
      );
    }

    this.projectRoot = projectRoot;
    this.debug = options.debug || false;
    this.watch = options.watch || false;
    this.configPath =
      options.configPath ||
      this.deps.fileSystem.joinPath(projectRoot, "gather-ts.config.json");

    this.config = { ...defaultConfig };
    this.initializeMetrics();

    this.logDebug(`ConfigManager created with root: ${projectRoot}`);
    this.logDebug(`Using config path: ${this.configPath}`);
  }

  // Delegate EventEmitter methods
  public on(event: string | symbol, listener: (...args: any[]) => void): this {
    this.eventEmitter.on(event, listener);
    return this;
  }

  public emit(event: string | symbol, ...args: any[]): boolean {
    return this.eventEmitter.emit(event, ...args);
  }

  public removeAllListeners(event?: string | symbol): this {
    this.eventEmitter.removeAllListeners(event);
    return this;
  }

  public override async initialize(): Promise<void> {
    this.logDebug("Initializing ConfigManager");

    try {
      await super.initialize();
      await this.loadConfig();

      if (this.watch) {
        this.startWatching();
      }

      this.logDebug("ConfigManager initialization complete");
    } catch (error) {
      throw new ConfigurationError(
        `Failed to initialize ConfigManager: ${
          error instanceof Error ? error.message : String(error)
        }`,
        this.configPath,
      );
    }
  }

  public override cleanup(): void {
    this.logDebug("Cleaning up ConfigManager");

    if (this.watchHandler) {
      clearInterval(this.watchHandler);
      this.watchHandler = undefined;
    }

    this.removeAllListeners();
    super.cleanup();
  }

  private initializeMetrics(): void {
    this.metrics = {
      loads: 0,
      updates: 0,
      validationErrors: 0,
      lastUpdate: undefined,
    };
  }

  private logDebug(message: string): void {
    if (this.debug) {
      this.deps.logger.debug(message);
    }
  }

  public getConfig(): IGatherTSConfig {
    this.checkInitialized();
    return { ...this.config };
  }

  private startWatching(): void {
    this.logDebug("Starting config file watch");

    if (this.watchHandler) {
      clearInterval(this.watchHandler);
    }

    this.watchHandler = setInterval(async () => {
      try {
        const stats = this.deps.fileSystem.statSync(this.configPath);
        if (stats.mtime.getTime() !== this.metrics.lastUpdate) {
          this.logDebug("Config file change detected");
          await this.loadConfig({ isWatch: true });
        }
      } catch (error) {
        this.deps.logger.warn(
          `Error watching config file: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }, 1000) as unknown as NodeJS.Timeout;
  }

  private async loadConfig(options: IConfigLoadOptions = {}): Promise<void> {
    this.logDebug(`Loading configuration${options.isWatch ? " (watch)" : ""}`);

    let fileConfig: Partial<IGatherTSConfig> = {};

    try {
      if (this.deps.fileSystem.exists(this.configPath)) {
        const configContent = await this.deps.fileSystem.readFile(
          this.configPath,
        );
        fileConfig = JSON.parse(configContent);
        this.logDebug("Loaded configuration from file");
      } else {
        this.logDebug("No config file found, using defaults");
      }

      const newConfig = {
        ...defaultConfig,
        ...fileConfig,
      };

      const validation = this.validateConfig(newConfig);
      if (!validation.isValid) {
        throw new ConfigurationError(
          `Configuration validation failed: ${validation.errors.join(", ")}`,
          this.configPath,
        );
      }

      const oldConfig = this.config;
      this.config = newConfig;

      this.metrics.loads++;
      this.metrics.lastUpdate = Date.now();

      this.emit("configChange", {
        type: "update",
        oldConfig,
        newConfig,
        timestamp: Date.now(),
        isWatch: options.isWatch,
      } as IConfigChangeEvent);
    } catch (error) {
      this.metrics.validationErrors++;
      throw new ConfigurationError(
        `Failed to load configuration: ${
          error instanceof Error ? error.message : String(error)
        }`,
        this.configPath,
      );
    }
  }

  public async updateConfig(
    updates: Partial<IGatherTSConfig>,
  ): Promise<IGatherTSConfig> {
    this.logDebug("Updating configuration");

    try {
      const newConfig = {
        ...this.config,
        ...updates,
      };

      const validation = this.validateConfig(newConfig);
      if (!validation.isValid) {
        throw new ValidationError(
          `Invalid configuration updates: ${validation.errors.join(", ")}`,
        );
      }

      const oldConfig = this.config;
      this.config = newConfig;

      this.metrics.updates++;
      this.metrics.lastUpdate = Date.now();

      await this.saveConfig();

      this.emit("configChange", {
        type: "update",
        oldConfig,
        newConfig,
        timestamp: Date.now(),
      } as IConfigChangeEvent);

      return this.getConfig();
    } catch (error) {
      throw new ConfigurationError(
        `Failed to update configuration: ${
          error instanceof Error ? error.message : String(error)
        }`,
        this.configPath,
      );
    }
  }

  public async saveConfig(): Promise<void> {
    this.logDebug("Saving configuration");

    try {
      const configString = JSON.stringify(this.config, null, 2);
      await this.deps.fileSystem.writeFile(this.configPath, configString);
      this.logDebug("Configuration saved successfully");
    } catch (error) {
      throw new ConfigurationError(
        `Failed to save configuration: ${
          error instanceof Error ? error.message : String(error)
        }`,
        this.configPath,
      );
    }
  }

  public reset(): void {
    this.logDebug("Resetting configuration to defaults");

    const oldConfig = this.config;
    this.config = { ...defaultConfig };
    this.metrics.updates++;
    this.metrics.lastUpdate = Date.now();

    this.emit("configChange", {
      type: "reset",
      oldConfig,
      newConfig: this.config,
      timestamp: Date.now(),
    } as IConfigChangeEvent);
  }

  public getMetrics(): IConfigMetrics {
    return { ...this.metrics };
  }

  public onConfigChange(callback: (event: IConfigChangeEvent) => void): void {
    this.on("configChange", callback);
  }

  public getProjectRoot(): string {
    return this.projectRoot;
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
    return this.debug;
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
        this.configPath,
      );
    }

    return limit;
  }

  public getTokenWarning(totalTokens: number): string | null {
    if (!this.config.tokenizer.showWarning) return null;

    const limit = this.getModelTokenLimit();
    if (totalTokens > limit) {
      return `Total tokens (${totalTokens.toLocaleString()}) exceed ${
        this.config.tokenizer.model
      }'s context limit of ${limit.toLocaleString()}`;
    }
    return null;
  }

  public validateConfig(
    config: Partial<IGatherTSConfig>,
  ): IConfigValidationResult {
    this.logDebug("Validating configuration");

    const result: IConfigValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Validate with deps.validator
      this.deps.validator.validate(config, "config", {
        requiredFields: ["tokenizer", "outputFormat"],
      });

      // Validate tokenizer configuration
      if (config.tokenizer) {
        this.validateTokenizerConfig(config, result);
      }

      // Validate output format
      if (config.outputFormat) {
        this.validateOutputFormat(config, result);
      }

      // Validate max depth
      if (config.maxDepth !== undefined) {
        if (typeof config.maxDepth !== "number" || config.maxDepth < 0) {
          result.errors.push("maxDepth must be a positive number or undefined");
          result.isValid = false;
        } else if (config.maxDepth > 10) {
          result.warnings.push("High maxDepth value may impact performance");
        }
      }

      // Validate top files count
      if (config.topFilesCount !== undefined) {
        if (
          typeof config.topFilesCount !== "number" ||
          config.topFilesCount < 1
        ) {
          result.errors.push("topFilesCount must be a positive number");
          result.isValid = false;
        } else if (config.topFilesCount > 20) {
          result.warnings.push(
            "Large topFilesCount value may impact readability",
          );
        }
      }
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : String(error),
      );
      result.isValid = false;
    }

    // Update metrics if validation failed
    if (!result.isValid) {
      this.metrics.validationErrors++;
    }

    return result;
  }

  private validateTokenizerConfig(
    config: Partial<IGatherTSConfig>,
    result: IConfigValidationResult,
  ): void {
    const validModels: TiktokenModel[] = [
      "gpt-3.5-turbo",
      "gpt-4",
      "gpt-4o",
      "gpt-4o-mini",
      "o1",
      "o1-mini",
      "o3-mini",
    ];

    if (!config.tokenizer) {
      result.errors.push("Missing tokenizer configuration");
      result.isValid = false;
      return;
    }

    if (!validModels.includes(config.tokenizer.model)) {
      result.errors.push(
        `Invalid tokenizer model. Valid models are: ${validModels.join(", ")}`,
      );
      result.isValid = false;
    }

    if (typeof config.tokenizer.showWarning !== "boolean") {
      result.errors.push("tokenizer.showWarning must be a boolean");
      result.isValid = false;
    }
  }

  private validateOutputFormat(
    config: Partial<IGatherTSConfig>,
    result: IConfigValidationResult,
  ): void {
    if (!config.outputFormat) {
      result.errors.push("Missing output format configuration");
      result.isValid = false;
      return;
    }

    const booleanFields = [
      "includeSummaryInFile",
      "includeGenerationTime",
      "includeUsageGuidelines",
    ] as const;

    booleanFields.forEach(field => {
      if (
        config.outputFormat![field] !== undefined &&
        typeof config.outputFormat![field] !== "boolean"
      ) {
        result.errors.push(`outputFormat.${field} must be a boolean`);
        result.isValid = false;
      }
    });

    if (
      config.outputFormat.format !== undefined &&
      !["json", "text", "markdown"].includes(config.outputFormat.format)
    ) {
      result.errors.push(
        "outputFormat.format must be one of: json, text, markdown",
      );
      result.isValid = false;
    }
  }
}

Object.assign(ConfigManager.prototype, EventEmitter.prototype);
