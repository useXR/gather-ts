import {
  IBaseError,
  IErrorDetails,
  IValidationErrorDetails,
  IFileSystemErrorDetails,
  IConfigurationErrorDetails,
  ITokenizationErrorDetails,
  IDependencyAnalysisErrorDetails
} from '../interfaces/IError';

export class DeppackError extends Error implements IBaseError {
  public readonly details?: IErrorDetails;

  constructor(message: string, details?: IErrorDetails) {
    super(message);
    this.name = 'DeppackError';
    this.details = details;
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, DeppackError.prototype);
  }

  public toJSON() {
    return {
      name: this.name,
      message: this.message,
      details: this.details,
      stack: this.stack
    };
  }
}

export class ValidationError extends DeppackError {
  public readonly details: IValidationErrorDetails;

  constructor(message: string, details?: IValidationErrorDetails) {
    super(message, details);
    this.name = 'ValidationError';
    this.details = details || {};
    
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class FileSystemError extends DeppackError {
  public readonly details: IFileSystemErrorDetails;

  constructor(message: string, filePath: string, operation: IFileSystemErrorDetails['operation']) {
    const details: IFileSystemErrorDetails = { filePath, operation };
    super(message, details);
    this.name = 'FileSystemError';
    this.details = details;
    
    Object.setPrototypeOf(this, FileSystemError.prototype);
  }
}

export class ConfigurationError extends DeppackError {
  public readonly details: IConfigurationErrorDetails;

  constructor(message: string, configPath: string, details?: Omit<IConfigurationErrorDetails, 'configPath'>) {
    const errorDetails: IConfigurationErrorDetails = { configPath, ...details };
    super(message, errorDetails);
    this.name = 'ConfigurationError';
    this.details = errorDetails;
    
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

export class TokenizationError extends DeppackError {
  public readonly details: ITokenizationErrorDetails;

  constructor(message: string, filePath: string, operation: ITokenizationErrorDetails['operation'], model?: string) {
    const details: ITokenizationErrorDetails = { filePath, operation, model };
    super(message, details);
    this.name = 'TokenizationError';
    this.details = details;
    
    Object.setPrototypeOf(this, TokenizationError.prototype);
  }
}

export class DependencyAnalysisError extends DeppackError {
  public readonly details: IDependencyAnalysisErrorDetails;

  constructor(message: string, entryPoint?: string, failedDependencies?: string[]) {
    const details: IDependencyAnalysisErrorDetails = { entryPoint, failedDependencies };
    super(message, details);
    this.name = 'DependencyAnalysisError';
    this.details = details;
    
    Object.setPrototypeOf(this, DependencyAnalysisError.prototype);
  }
}