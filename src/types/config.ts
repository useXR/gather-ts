import { TiktokenModel } from "./models/tokenizer";
import { DeepPartial } from "./common";

export interface ITokenizerConfig {
  model: TiktokenModel;
  showWarning: boolean;
  contextLimit?: number;
  customProperties?: Record<string, unknown>;
}

export interface IOutputConfig {
  includeSummaryInFile: boolean;
  includeGenerationTime: boolean;
  includeUsageGuidelines: boolean;
  format?: "json" | "text" | "markdown";
}

export interface ICustomText {
  header?: string;
  footer?: string;
  beforeSummary?: string;
  afterSummary?: string;
  beforeFiles?: string;
}

export interface IGatherTSConfig {
  maxDepth?: number;
  topFilesCount: number;
  showTokenCount: boolean;
  tokenizer: ITokenizerConfig;
  outputFormat: IOutputConfig;
  debug?: boolean;
  cacheTokenCounts?: boolean;
  requiredFiles?: string[];
  customText?: ICustomText;
}

export type ConfigOverrides = DeepPartial<IGatherTSConfig>;

export interface IConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface IConfigLoadResult {
  config: IGatherTSConfig;
  source: "file" | "default" | "override";
  validation: IConfigValidationResult;
}
