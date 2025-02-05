export type TiktokenModel = 
  | "gpt-3.5-turbo"
  | "gpt-4"
  | "gpt-4o"
  | "gpt-4o-mini"
  | "o1"
  | "o1-mini"
  | "o3-mini";

export interface IModelConfig {
  name: TiktokenModel;
  contextLimit: number;
  tokenizerConfig?: Record<string, unknown>;
}

export interface ITokenizerOptions {
  model: TiktokenModel;
  customProperties?: Record<string, unknown>;
}

export interface ITokenizationResult {
  tokens: number;
  text: string;
  model: TiktokenModel;
  truncated: boolean;
}

export interface IModelStats {
  modelName: TiktokenModel;
  maxContextLength: number;
  averageTokensPerChar: number;
  supportedFeatures: string[];
}