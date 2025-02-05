export interface IErrorDetails {
  [key: string]: unknown;
}

export interface IBaseError extends Error {
  readonly details?: IErrorDetails;
}

export interface IValidationErrorDetails extends IErrorDetails {
  filePath?: string;
  providedValue?: unknown;
  expectedType?: string;
  allowedValues?: unknown[];
}

export interface IFileSystemErrorDetails extends IErrorDetails {
  filePath: string;
  operation: 'read' | 'write' | 'delete' | 'create';
}

export interface IConfigurationErrorDetails extends IErrorDetails {
  configPath: string;
  invalidFields?: string[];
  providedValue?: unknown;
  allowedValues?: unknown[];
}

export interface ITokenizationErrorDetails extends IErrorDetails {
  filePath: string;
  operation: 'encode' | 'decode' | 'initialize' | 'cleanup';
  model?: string;
}

export interface IDependencyAnalysisErrorDetails extends IErrorDetails {
  entryPoint?: string;
  failedDependencies?: string[];
}

export interface IErrorHandler {
  handle(error: Error): void;
  logError(error: Error): void;
  formatErrorDetails(details: IErrorDetails): string;
}

export interface IErrorHandlerOptions {
  logToConsole?: boolean;
  logToFile?: boolean;
  rethrow?: boolean;
  logFilePath?: string;
}

export interface IErrorUtils {
  isDeppackError(error: unknown): error is IBaseError;
  wrapError(error: unknown, context: string): Error;
  formatErrorMessage(message: string, details?: IErrorDetails): string;
}