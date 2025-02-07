// src/types/services.ts

import { ICompileOptions, ICompileResult } from "compiler";
import { IDeppackConfig, IConfigValidationResult } from "config";
import { IFileWithContent } from "files";
import { ISummaryStats } from "stats";

export interface IService {
  isInitialized: boolean;
  initialize(): Promise<void>;
  cleanup(): void;
}

export interface ICompilationService extends IService {
  compile(options: ICompileOptions): Promise<ICompileResult>;
  validateOptions(options: ICompileOptions): Promise<boolean>;
}

export interface ITokenizationService extends IService {
  countTokens(filePath: string, text: string): Promise<number>;
  generateSummary(filesWithContent: IFileWithContent[]): Promise<ISummaryStats>;
  generateSummaryText(stats: ISummaryStats): string;
  printSummary(stats: ISummaryStats, outputFile: string): void;
}

export interface IConfigurationService extends IService {
  validateConfig(config: Partial<IDeppackConfig>): IConfigValidationResult;
  loadConfig(configPath: string): Promise<IDeppackConfig>;
  saveConfig(config: IDeppackConfig, configPath: string): Promise<void>;
  getDefaultConfig(): IDeppackConfig;
}

export interface IDependencyService extends IService {
  analyzeDependencies(
    entryFile: string,
    projectRoot: string
  ): Promise<string[]>;
  validateEntryPoints(entryFiles: string[]): Promise<boolean>;
  getDependencyGraph(): Promise<Map<string, string[]>>;
}

export interface ICacheService extends IService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

// src/types/services.ts

export abstract class BaseService implements IService {
  isInitialized: boolean = false;

  public async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  public cleanup(): void {
    this.isInitialized = false;
  }

  protected checkInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(`${this.constructor.name} not initialized`);
    }
  }
}