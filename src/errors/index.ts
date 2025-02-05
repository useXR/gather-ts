import { ErrorHandler } from './handlers/ErrorHandler';

export * from './exceptions';
export * from './handlers/ErrorHandler';
export * from './utils/ErrorUtils';
export * from './interfaces/IError';

// Export a default error handler instance
export const defaultErrorHandler = new ErrorHandler();