import { logger } from '@/utils/logging';
import { fileSystem } from '@/utils/filesystem/FileSystem';
import { IErrorHandler, IErrorHandlerOptions, IErrorDetails } from '../interfaces/IError';
import { DeppackError } from '../exceptions';
import { IFileSystem } from '@/utils/filesystem/interfaces/IFileSystem';

export class ErrorHandler implements IErrorHandler {
  private readonly options: IErrorHandlerOptions;
  private readonly fs: IFileSystem;

  constructor(options: IErrorHandlerOptions = {}, fs: IFileSystem = fileSystem) {
    this.options = {
      logToConsole: true,
      logToFile: false,
      rethrow: false,
      ...options
    };
    this.fs = fs;
  }

  public handle(error: Error): void {
    if (this.options.logToConsole) {
      this.logError(error);
    }

    if (this.options.logToFile && this.options.logFilePath) {
      this.logErrorToFile(error);
    }

    if (this.options.rethrow) {
      throw error;
    }
  }

  public logError(error: Error): void {
    if (error instanceof DeppackError) {
      logger.error(`${error.name}: ${error.message}`);
      if (error.details && Object.keys(error.details).length > 0) {
        logger.debug(`Details: ${this.formatErrorDetails(error.details)}`);
      }
      if (error.stack) {
        logger.debug('Stack trace:');
        logger.debug(error.stack);
      }
    } else {
      logger.error(`Unexpected error: ${error.message}`);
      if (error.stack) {
        logger.debug(error.stack);
      }
    }
  }

  private logErrorToFile(error: Error): void {
    if (!this.options.logFilePath) {
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      const errorLog = this.formatErrorForFile(error, timestamp);
      
      // Ensure the directory exists
      const dir = this.fs.getDirName(this.options.logFilePath);
      if (!this.fs.exists(dir)) {
        this.fs.createDirectory(dir, true);
      }

      // Append the error to the log file
      this.fs.writeFileSync(
        this.options.logFilePath,
        errorLog + '\n',
        { flag: 'a' }
      );
    } catch (logError) {
      logger.error(`Failed to write error to log file: ${logError instanceof Error ? logError.message : String(logError)}`);
    }
  }

  private formatErrorForFile(error: Error, timestamp: string): string {
    const parts = [`[${timestamp}] ${error.name}: ${error.message}`];

    if (error instanceof DeppackError && error.details) {
      parts.push(`Details: ${this.formatErrorDetails(error.details)}`);
    }

    if (error.stack) {
      parts.push('Stack trace:', error.stack);
    }

    return parts.join('\n');
  }

  public formatErrorDetails(details: IErrorDetails): string {
    return Object.entries(details)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}: [${value.join(', ')}]`;
        }
        return `${key}: ${value}`;
      })
      .join(', ');
  }
}