import { IErrorUtils, IErrorDetails, IBaseError, IErrorHandlerOptions, IErrorHandler } from '../interfaces/IError';
import { DeppackError } from '../exceptions';
import { ErrorHandler } from '../handlers/ErrorHandler';

const errorHandler = new ErrorHandler();

export const errorUtils: IErrorUtils = {
  isDeppackError(error: unknown): error is IBaseError {
    return error instanceof DeppackError;
  },

  wrapError(error: unknown, context: string): Error {
    if (error instanceof DeppackError) {
      return error;
    }
    return new DeppackError(
      `${context}: ${error instanceof Error ? error.message : String(error)}`
    );
  },

  formatErrorMessage(message: string, details?: IErrorDetails): string {
    if (!details) {
      return message;
    }
    return `${message} (${errorHandler.formatErrorDetails(details)})`;
  }
};

// Helper function to create error handlers with specific logging behaviors
export function createErrorHandler(options: IErrorHandlerOptions): IErrorHandler {
  return new ErrorHandler(options);
}