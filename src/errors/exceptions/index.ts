import {
  IBaseError,
  IErrorDetails,
  IValidationErrorDetails,
  IFileSystemErrorDetails,
  ITokenizationErrorDetails,
  IDependencyAnalysisErrorDetails,
} from "errors";
import {
  ICacheErrorDetails,
  ICompilationErrorDetails,
} from "../interfaces/error-types";

/**
 * Base class for all gather-ts errors
 */
export abstract class GatherTSError extends Error implements IBaseError {
  public abstract readonly name: string;
  public readonly details?: IErrorDetails;
  public readonly timestamp: string;

  constructor(message: string, details?: IErrorDetails) {
    super(message);
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON() {
    return {
      name: this.name,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Input validation errors
 */
export class ValidationError extends GatherTSError {
  public readonly name = "ValidationError";

  constructor(message: string, details?: IValidationErrorDetails) {
    super(message, details);
  }
}

/**
 * File system operation errors
 */
export class FileSystemError extends GatherTSError {
  public readonly name = "FileSystemError";

  constructor(
    message: string,
    filePath: string,
    operation: IFileSystemErrorDetails["operation"],
  ) {
    super(message, { filePath, operation });
  }

  get filePath(): string {
    return (this.details as IFileSystemErrorDetails).filePath;
  }

  get operation(): IFileSystemErrorDetails["operation"] {
    return (this.details as IFileSystemErrorDetails).operation;
  }
}

/**
 * Configuration related errors
 */
export class ConfigurationError extends GatherTSError {
  public readonly name = "ConfigurationError";

  constructor(message: string, configPath: string) {
    // Ensure configPath is non-null and non-undefined
    if (!configPath) {
      configPath = "unknown";
    }
    super(message, { configPath });
  }
}

/**
 * Token processing errors
 */
export class TokenizationError extends GatherTSError {
  public readonly name = "TokenizationError";

  constructor(
    message: string,
    filePath: string,
    operation: ITokenizationErrorDetails["operation"],
    model?: string,
  ) {
    super(message, { filePath, operation, model });
  }

  get filePath(): string {
    return (this.details as ITokenizationErrorDetails).filePath;
  }

  get operation(): ITokenizationErrorDetails["operation"] {
    return (this.details as ITokenizationErrorDetails).operation;
  }
}

/**
 * Dependency analysis errors
 */
export class DependencyAnalysisError extends GatherTSError {
  public readonly name = "DependencyAnalysisError";

  constructor(
    message: string,
    entryPoint?: string,
    failedDependencies?: string[],
  ) {
    super(message, { entryPoint, failedDependencies });
  }

  get entryPoint(): string | undefined {
    return (this.details as IDependencyAnalysisErrorDetails).entryPoint;
  }

  get failedDependencies(): string[] | undefined {
    return (this.details as IDependencyAnalysisErrorDetails).failedDependencies;
  }
}

/**
 * Cache operation errors
 */
export class CacheError extends GatherTSError {
  public readonly name = "CacheError";

  constructor(
    message: string,
    operation: ICacheErrorDetails["operation"],
    key?: string,
  ) {
    super(message, { operation, key });
  }

  get operation(): ICacheErrorDetails["operation"] {
    return (this.details as ICacheErrorDetails).operation;
  }
}

/**
 * Compilation process errors
 */
export class CompilationError extends GatherTSError {
  public readonly name = "CompilationError";

  constructor(
    message: string,
    phase: ICompilationErrorDetails["phase"],
    details?: Omit<ICompilationErrorDetails, "phase">,
  ) {
    super(message, { phase, ...details });
  }

  get phase(): ICompilationErrorDetails["phase"] {
    return (this.details as ICompilationErrorDetails).phase;
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends GatherTSError {
  public readonly name = "TimeoutError";

  constructor(message: string, operation: string, timeout: number) {
    super(message, { operation, timeout });
  }
}

/**
 * Resource usage limit errors
 */
export class ResourceLimitError extends GatherTSError {
  public readonly name = "ResourceLimitError";

  constructor(
    message: string,
    resource: string,
    limit: number,
    actual: number,
  ) {
    super(message, { resource, limit, actual });
  }
}
