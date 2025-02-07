// src/errors/index.ts

export * from "./exceptions";
export * from "./handlers/ErrorHandler";
export * from "./utils/ErrorUtils";
export * from "./interfaces/IError";

import { ErrorHandler } from "./handlers/ErrorHandler";
import {
  IErrorHandlerDeps,
  IErrorHandlerOptions,
  IErrorHandler,
} from "./interfaces/IErrorHandler";

export function createErrorHandler(
  deps: IErrorHandlerDeps,
  options?: IErrorHandlerOptions,
): IErrorHandler {
  return new ErrorHandler(deps, options);
}
