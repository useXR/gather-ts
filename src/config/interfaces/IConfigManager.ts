import { IDeppackConfig } from '@/types/config';
import { IFileSystem } from '@/utils/filesystem/interfaces/IFileSystem';

export interface IConfigManager {
  getProjectRoot(): string;
  getConfig(): IDeppackConfig;
  getTokenizerModel(): string;
  getMaxDepth(): number | undefined;
  shouldShowTokenCount(): boolean;
  getTopFilesCount(): number;
  isDebugEnabled(): boolean;
  getModelTokenLimit(): number;
  getTokenWarning(totalTokens: number): string | null;
}

export interface IConfigValidator {
  validateConfig(config: Partial<IDeppackConfig>): void;
  validateTokenizerConfig(config: Partial<IDeppackConfig>): void;
  validateOutputFormat(config: Partial<IDeppackConfig>): void;
  validateCustomText(config: Partial<IDeppackConfig>): void;
}

export interface IConfigLoader {
  loadConfig(overrides?: Partial<IDeppackConfig>): IDeppackConfig;
}

export interface IConfigManagerOptions {
  fileSystem?: IFileSystem;
  configPath?: string;
  debug?: boolean;
}

// Static methods interface
export interface IConfigManagerStatic {
  generateDefaultConfig(outputPath: string): void;
}