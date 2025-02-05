// types/errors.ts
export interface IErrorDetails {
  [key: string]: unknown;
}

export interface IBaseError {
  name: string;
  message: string;
  details?: IErrorDetails;
  cause?: Error;
}

export interface IValidationErrorDetails extends IErrorDetails {
  filePath?: string;
  providedValue?: unknown;
  expectedType?: string;
  allowedValues?: unknown[];
}

export interface IFileSystemErrorDetails extends IErrorDetails {
  filePath: string;
  operation: "read" | "write" | "delete" | "create";
}

export interface IConfigurationErrorDetails extends IErrorDetails {
  configPath?: string;
  invalidFields?: string[];
  providedValue?: unknown;
  allowedValues?: unknown[];
}

export interface ITokenizationErrorDetails extends IErrorDetails {
  filePath: string;
  operation: "encode" | "decode" | "initialize" | "cleanup";
  model?: string;
}

export interface IDependencyAnalysisErrorDetails extends IErrorDetails {
  entryPoint?: string;
  failedDependencies?: string[];
}