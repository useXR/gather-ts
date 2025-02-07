import { ILogger } from "@/utils";
import { IBaseError, IErrorDetails } from "errors";
import { IService } from "@/types/services";
import { IErrorClassification, IErrorTransformation } from "./IError";

// Error Utils types
export interface IErrorUtilsDeps {
  logger: ILogger;
}

export interface IErrorUtilsOptions {
  debug?: boolean;
}

export interface IErrorUtils extends IService {
  isGatherTSError(error: unknown): error is IBaseError;
  wrapError(error: unknown, context: string): Error;
  formatErrorDetails(details: IErrorDetails): string;
  aggregateErrors(errors: Error[]): Error;
  classifyError(error: unknown): IErrorClassification;
  transformError(
    error: unknown,
    transformations: IErrorTransformation[],
  ): Error;
  extractErrorContext(error: Error): Record<string, unknown>;
  normalizeError(error: unknown): Error;
}
