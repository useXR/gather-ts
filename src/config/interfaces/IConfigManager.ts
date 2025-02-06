// src/config/interfaces/IConfigManager.ts

import { IService } from '@/types/services';
import { IFileSystem } from '@/utils/filesystem/interfaces/IFileSystem';
import { ILogger } from '@/utils/logging/interfaces/ILogger';
import { IValidator } from '@/utils/validation/interfaces/IValidator';
import { IDeppackConfig, IConfigValidationResult } from '@/types/config';

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
  arrayMergeStrategy?: 'replace' | 'concat' | 'unique';
}

/**
 * Configuration change event data
 */
export interface IConfigChangeEvent {
  /** Type of change */
  type: 'update' | 'reset';
  /** Previous configuration */
  oldConfig?: IDeppackConfig;
  /** New configuration */
  newConfig: IDeppackConfig;
  /** Timestamp of change */
  timestamp: number;
  /** Whether change was from watch */
  isWatch?: boolean;
}

export interface IConfigValidator {
  validateConfig(config: Partial<IDeppackConfig>): void;
  validateTokenizerConfig(config: Partial<IDeppackConfig>): void;
  validateOutputFormat(config: Partial<IDeppackConfig>): void;
  validateCustomText(config: Partial<IDeppackConfig>): void;
  validateAll(config: Partial<IDeppackConfig>): IConfigValidationResult;
}

/**
 * Configuration validation event data
 */
export interface IConfigValidationEvent {
  /** Validation result */
  result: IConfigValidationResult;
  /** Configuration being validated */
  config: Partial<IDeppackConfig>;
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
  initialize(): Promise<void>;
  
  /** Get current configuration */
  getConfig(): IDeppackConfig;

  /** Update configuration */
  updateConfig(updates: Partial<IDeppackConfig>): Promise<IDeppackConfig>;

  /** Save configuration to disk */
  saveConfig(): Promise<void>;

  /** Reset configuration to defaults */
  reset(): void;

  /** Get configuration metrics */
  getMetrics(): IConfigMetrics;

  /** Subscribe to configuration changes */
  onConfigChange(callback: (event: IConfigChangeEvent) => void): void;

  /** Get project root directory */
  getProjectRoot(): string;

  /** Get tokenizer model */
  getTokenizerModel(): string;

  /** Get maximum depth */
  getMaxDepth(): number | undefined;

  /** Check if token counting is enabled */
  shouldShowTokenCount(): boolean;

  /** Get number of top files to show */
  getTopFilesCount(): number;

  /** Check if debug mode is enabled */
  isDebugEnabled(): boolean;

  /** Get model token limit */
  getModelTokenLimit(): number;

  /** Get token warning if applicable */
  getTokenWarning(totalTokens: number): string | null;

  /** Validate configuration */
  validateConfig(config: Partial<IDeppackConfig>): IConfigValidationResult;
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
  'configChange': IConfigChangeEvent;
  'configValidation': IConfigValidationEvent;
  'error': Error;
  'warning': string;
}