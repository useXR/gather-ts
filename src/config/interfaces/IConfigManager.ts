// src/config/interfaces/IConfigManager.ts

import { IService } from "@/types/services";
import { IFileSystem } from "@/utils/filesystem/interfaces/IFileSystem";
import { ILogger } from "@/utils/logging/interfaces/ILogger";
import { IValidator } from "@/utils/validation/interfaces/IValidator";
import { IGatherTSConfig, IConfigValidationResult } from "@/types/config";

/**
 * Dependencies required by ConfigManager
 */
export interface IConfigManagerDeps {
  fileSystem: IFileSystem;
  logger: ILogger;
  validator: IValidator;
}

/**
 * Configuration options for ConfigManager
 */
export interface IConfigManagerOptions {
  /** Custom config file path */
  configPath?: string;
  /** Enable debug mode */
  debug?: boolean;
  /** Watch for config changes */
  watch?: boolean;
}

/**
 * Options for loading configuration
 */
export interface IConfigLoadOptions {
  /** Whether the load is triggered by watch */
  isWatch?: boolean;
  /** Skip validation */
  skipValidation?: boolean;
  /** Merge strategy for arrays */
  arrayMergeStrategy?: "replace" | "concat" | "unique";
}

/**
 * Configuration change event data
 */
export interface IConfigChangeEvent {
  /** Type of change */
  type: "update" | "reset";
  /** Previous configuration */
  oldConfig?: IGatherTSConfig;
  /** New configuration */
  newConfig: IGatherTSConfig;
  /** Timestamp of change */
  timestamp: number;
  /** Whether change was from watch */
  isWatch?: boolean;
}

export interface IConfigValidator {
  validateConfig(config: Partial<IGatherTSConfig>): void;
  validateTokenizerConfig(config: Partial<IGatherTSConfig>): void;
  validateOutputFormat(config: Partial<IGatherTSConfig>): void;
  validateCustomText(config: Partial<IGatherTSConfig>): void;
  validateAll(config: Partial<IGatherTSConfig>): IConfigValidationResult;
}

/**
 * Configuration validation event data
 */
export interface IConfigValidationEvent {
  /** Validation result */
  result: IConfigValidationResult;
  /** Configuration being validated */
  config: Partial<IGatherTSConfig>;
  /** Timestamp of validation */
  timestamp: number;
}

/**
 * Configuration metrics
 */
export interface IConfigMetrics {
  /** Number of configuration loads */
  loads: number;
  /** Number of configuration updates */
  updates: number;
  /** Number of validation errors */
  validationErrors: number;
  /** Last update timestamp */
  lastUpdate?: number;
}

/**
 * Core ConfigManager interface
 */
export interface IConfigManager extends IService {
  // EventEmitter methods we need
  on(event: string | symbol, listener: (...args: any[]) => void): this;
  emit(event: string | symbol, ...args: any[]): boolean;
  removeAllListeners(event?: string | symbol): this;

  // Config-specific methods
  getConfig(): IGatherTSConfig;
  updateConfig(updates: Partial<IGatherTSConfig>): Promise<IGatherTSConfig>;
  saveConfig(): Promise<void>;
  reset(): void;
  getMetrics(): IConfigMetrics;
  onConfigChange(callback: (event: IConfigChangeEvent) => void): void;
  getProjectRoot(): string;
  getTokenizerModel(): string;
  getMaxDepth(): number | undefined;
  shouldShowTokenCount(): boolean;
  getTopFilesCount(): number;
  isDebugEnabled(): boolean;
  getModelTokenLimit(): number;
  getTokenWarning(totalTokens: number): string | null;
  validateConfig(config: Partial<IGatherTSConfig>): IConfigValidationResult;
}

/**
 * Static methods for ConfigManager
 */
export interface IConfigManagerStatic {
  /** Generate default configuration file */
  generateDefaultConfig(outputPath: string, fileSystem: IFileSystem): void;
}

/**
 * ConfigManager events map
 */
export interface IConfigManagerEvents {
  configChange: IConfigChangeEvent;
  configValidation: IConfigValidationEvent;
  error: Error;
  warning: string;
}
