// src/utils/validation/interfaces/IValidator.ts

import { IService } from "@/types/services";
import { ILogger } from "@/utils/logging/interfaces/ILogger";

export interface IValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface IValidationOptions {
  optional?: boolean;
  allowEmpty?: boolean;
  type?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  integer?: boolean;
  pattern?: RegExp;
  arrayType?: string;
  requiredFields?: string[];
  customValidator?: (value: any) => boolean;
}

export interface IValidatorDeps {
  logger: ILogger;
}

export interface IValidatorOptions {
  debug?: boolean;
}

export interface ITypeValidator {
  isString(value: unknown): value is string;
  isNumber(value: unknown): value is number;
  isBoolean(value: unknown): value is boolean;
  isObject(value: unknown): value is object;
  isArray(value: unknown): value is unknown[];
  isDate(value: unknown): value is Date;
}

export interface IValidator extends IService, ITypeValidator {
  validate<T>(
    value: unknown,
    fieldName: string,
    options?: IValidationOptions,
  ): IValidationResult;
  validateNotEmpty<T>(value: T | null | undefined, fieldName: string): T;
  validateType(value: unknown, expectedType: string, fieldName: string): void;
  validateRange(
    value: number,
    min: number,
    max: number,
    fieldName: string,
  ): void;
  validateEnum<T extends string>(
    value: string,
    enumValues: readonly T[],
    fieldName: string,
  ): T;
  validatePattern(value: string, pattern: RegExp, fieldName: string): void;
  validatePath(path: string, context: string): void;
}
