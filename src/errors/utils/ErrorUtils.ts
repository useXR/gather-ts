// src/errors/utils/ErrorUtils.ts

import { 
  IErrorDetails, 
  IBaseError,
  IErrorClassification,
  IErrorTransformation,
} from '../interfaces/IError';
import { DeppackError } from '../exceptions';
import { IErrorUtils, IErrorUtilsDeps, IErrorUtilsOptions } from '../interfaces/IErrorUtils';

export class ErrorUtils implements IErrorUtils {
  private readonly debug: boolean;

  constructor(
    private readonly deps: IErrorUtilsDeps,
    options: IErrorUtilsOptions = {}
  ) {
    this.debug = options.debug || false;
  }

  public async initialize(): Promise<void> {
    this.logDebug('ErrorUtils service initialized');
  }

  public cleanup(): void {
    this.logDebug('ErrorUtils service cleanup');
  }

  private logDebug(message: string): void {
    if (this.debug) {
      this.deps.logger.debug(message);
    }
  }

  public isDeppackError(error: unknown): error is IBaseError {
    return error instanceof DeppackError;
  }

  public wrapError(error: unknown, context: string): Error {
    if (error instanceof DeppackError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const wrapped = new Error(`${context}: ${message}`);

    if (error instanceof Error) {
      wrapped.stack = error.stack;
    }

    return wrapped;
  }

  public formatErrorDetails(details: IErrorDetails): string {
    return Object.entries(details)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}: [${value.join(', ')}]`;
        }
        if (value instanceof Error) {
          return `${key}: ${value.message}`;
        }
        if (typeof value === 'object' && value !== null) {
          return `${key}: ${JSON.stringify(value)}`;
        }
        return `${key}: ${value}`;
      })
      .join(', ');
  }

  public aggregateErrors(errors: Error[]): Error {
    if (errors.length === 0) {
      return new Error('No errors to aggregate');
    }

    if (errors.length === 1) {
      return errors[0];
    }

    const messages = errors.map((err, index) => {
      const prefix = errors.length > 1 ? `${index + 1}. ` : '';
      return prefix + (err instanceof Error ? err.message : String(err));
    });

    const err = new Error(`Multiple errors occurred:\n${messages.join('\n')}`);
    err.name = 'AggregateError';
    return err;
  }

  public classifyError(error: unknown): IErrorClassification {
    const baseClassification: IErrorClassification = {
      type: 'UnknownError',
      severity: 'error',
      message: '',
      details: undefined,
      stackTrace: undefined
    };

    if (error instanceof DeppackError) {
      return {
        ...baseClassification,
        type: error.name,
        message: error.message,
        details: error.details,
        stackTrace: error.stack
      };
    }

    if (error instanceof Error) {
      return {
        ...baseClassification,
        type: error.name,
        message: error.message,
        stackTrace: error.stack
      };
    }

    return {
      ...baseClassification,
      message: String(error)
    };
  }

  public transformError(error: unknown, transformations: IErrorTransformation[]): Error {
    let transformed = error instanceof Error ? error : new Error(String(error));

    for (const transformation of transformations) {
      if (transformation.condition(transformed)) {
        transformed = transformation.transform(transformed);
      }
    }

    return transformed;
  }

  public extractErrorContext(error: Error): Record<string, unknown> {
    const context: Record<string, unknown> = {
      name: error.name,
      message: error.message
    };

    if (error instanceof DeppackError && error.details) {
      context.details = error.details;
    }

    if (this.debug && error.stack) {
      context.stack = error.stack;
    }

    return context;
  }

  public normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    if (error instanceof Object) {
      return new Error(JSON.stringify(error));
    }

    return new Error(String(error));
  }
}