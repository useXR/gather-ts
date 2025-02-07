// src/errors/interfaces/IErrorHandler.ts

import { IService } from "@/types/services";
import { ILogger } from "@/utils/logging/interfaces/ILogger";
import { IFileSystem } from "@/utils/filesystem/interfaces/IFileSystem";
import { IErrorUtils } from "./IErrorUtils";

// Error Handler types
export interface IErrorProcessingStrategy {
  shouldHandle: (error: Error) => boolean;
  handle: (error: Error, context: Record<string, unknown>) => void;
}

export interface IErrorOperationOptions {
  rethrow?: boolean;
  context?: Record<string, unknown>;
}

export interface IErrorHandlerDeps {
  logger: ILogger;
  fileSystem: IFileSystem;
  errorUtils: IErrorUtils;
}

export interface IErrorHandlerOptions {
  debug?: boolean;
  logToConsole?: boolean;
  logToFile?: boolean;
  logFilePath?: string;
  rethrow?: boolean;
}

export interface IErrorHandler extends IService {
  handle(error: Error, options?: IErrorOperationOptions): void;
  handleBatch(errors: Error[]): void;
  createErrorBoundary(fn: () => Promise<void>): Promise<void>;
  registerStrategy(strategy: IErrorProcessingStrategy): void;
}

export interface IErrorHandlerConfig extends IErrorHandlerOptions {
  strategies?: IErrorProcessingStrategy[];
}
