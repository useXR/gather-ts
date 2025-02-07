// src/utils/validation/Validator.ts

import { ValidationError } from "@/errors";
import {
  IValidator,
  IValidatorDeps,
  IValidationOptions,
  IValidationResult,
  ITypeValidator,
  IValidatorOptions,
} from "./interfaces/IValidator";
import { BaseService } from "@/types/services";

export class Validator
  extends BaseService
  implements IValidator, ITypeValidator
{
  private readonly debug: boolean;

  constructor(
    private readonly deps: IValidatorDeps,
    options: IValidatorOptions = {},
  ) {
    super();
    this.debug = options.debug || false;
  }

  public override async initialize(): Promise<void> {
    await super.initialize();
    this.logDebug("Validator service initialized");
  }

  public override cleanup(): void {
    this.logDebug("Validator service cleanup");
    super.cleanup();
  }

  private logDebug(message: string): void {
    if (this.debug) {
      this.deps.logger.debug(message);
    }
  }

  private handleValidationError(
    fieldName: string,
    message: string,
    details?: Record<string, unknown>,
  ): never {
    const error = new ValidationError(message, details);
    this.deps.logger.error(`Validation error for ${fieldName}: ${message}`);
    throw error;
  }

  public validate<T>(
    value: unknown,
    fieldName: string,
    options: IValidationOptions = {},
  ): IValidationResult {
    this.checkInitialized();
    this.logDebug(`Validating ${fieldName}`);

    const result: IValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Handle optional fields
      if (value === undefined || value === null) {
        if (!options.optional) {
          result.errors.push(`${fieldName} is required`);
          result.isValid = false;
        }
        return result;
      }

      // Type validation
      if (options.type && typeof value !== options.type) {
        result.errors.push(
          `${fieldName} must be of type ${options.type}, got ${typeof value}`,
        );
        result.isValid = false;
        return result;
      }

      // Type-specific validations
      if (typeof value === "string") {
        this.validateString(value, fieldName, options, result);
      }
      if (typeof value === "number") {
        this.validateNumber(value, fieldName, options, result);
      }
      if (Array.isArray(value)) {
        this.validateArray(value, fieldName, options, result);
      }
      if (this.isObject(value)) {
        this.validateObject(value, fieldName, options, result);
      }

      // Custom validation
      if (options.customValidator) {
        this.runCustomValidator(
          value,
          fieldName,
          options.customValidator,
          result,
        );
      }
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : String(error),
      );
      result.isValid = false;
      this.deps.logger.error(
        `Validation error for ${fieldName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    this.logDebug(
      `Validation result for ${fieldName}: ${result.isValid ? "valid" : "invalid"}`,
    );
    return result;
  }

  private validateString(
    value: string,
    fieldName: string,
    options: IValidationOptions,
    result: IValidationResult,
  ): void {
    if (!options.allowEmpty && value.trim() === "") {
      result.errors.push(`${fieldName} cannot be empty`);
      result.isValid = false;
      return;
    }

    if (options.minLength !== undefined && value.length < options.minLength) {
      result.errors.push(
        `${fieldName} must be at least ${options.minLength} characters long`,
      );
      result.isValid = false;
    }

    if (options.maxLength !== undefined && value.length > options.maxLength) {
      result.errors.push(
        `${fieldName} cannot exceed ${options.maxLength} characters`,
      );
      result.isValid = false;
    }

    if (options.pattern && !options.pattern.test(value)) {
      result.errors.push(`${fieldName} has an invalid format`);
      result.isValid = false;
    }
  }

  private validateNumber(
    value: number,
    fieldName: string,
    options: IValidationOptions,
    result: IValidationResult,
  ): void {
    if (options.min !== undefined && value < options.min) {
      result.errors.push(`${fieldName} must be at least ${options.min}`);
      result.isValid = false;
    }

    if (options.max !== undefined && value > options.max) {
      result.errors.push(`${fieldName} cannot exceed ${options.max}`);
      result.isValid = false;
    }

    if (options.integer && !Number.isInteger(value)) {
      result.errors.push(`${fieldName} must be an integer`);
      result.isValid = false;
    }
  }

  private validateArray(
    value: unknown[],
    fieldName: string,
    options: IValidationOptions,
    result: IValidationResult,
  ): void {
    if (options.minLength !== undefined && value.length < options.minLength) {
      result.errors.push(
        `${fieldName} must contain at least ${options.minLength} items`,
      );
      result.isValid = false;
    }

    if (options.maxLength !== undefined && value.length > options.maxLength) {
      result.errors.push(
        `${fieldName} cannot contain more than ${options.maxLength} items`,
      );
      result.isValid = false;
    }

    if (options.arrayType) {
      const invalidItems = value.filter(
        (item) => typeof item !== options.arrayType,
      );
      if (invalidItems.length > 0) {
        result.errors.push(
          `All items in ${fieldName} must be of type ${options.arrayType}`,
        );
        result.isValid = false;
      }
    }
  }

  private validateObject(
    value: object,
    fieldName: string,
    options: IValidationOptions,
    result: IValidationResult,
  ): void {
    if (options.requiredFields) {
      const missingFields = options.requiredFields.filter(
        (field) => !(field in value),
      );
      if (missingFields.length > 0) {
        result.errors.push(
          `${fieldName} is missing required fields: ${missingFields.join(", ")}`,
        );
        result.isValid = false;
      }
    }
  }

  public validatePath(path: string, context: string): void {
    if (!path || typeof path !== "string") {
      throw new ValidationError(`Invalid ${context} path`, { path });
    }

    // Check for invalid characters in path
    const invalidChars = /[<>:"|?*]/g;
    if (invalidChars.test(path)) {
      throw new ValidationError(`${context} path contains invalid characters`, {
        path,
        invalidChars: '<>:"|?*',
      });
    }

    // Check for relative path navigation
    if (path.includes("../") || path.includes("..\\")) {
      throw new ValidationError(
        `${context} path cannot contain relative navigation`,
        { path },
      );
    }

    // Log debug info
    this.logDebug(`Validated path for ${context}: ${path}`);
  }

  private runCustomValidator(
    value: unknown,
    fieldName: string,
    validator: (value: unknown) => boolean,
    result: IValidationResult,
  ): void {
    try {
      const customResult = validator(value);
      if (!customResult) {
        result.errors.push(`${fieldName} failed custom validation`);
        result.isValid = false;
      }
    } catch (error) {
      result.errors.push(
        `Custom validation error for ${fieldName}: ${error instanceof Error ? error.message : String(error)}`,
      );
      result.isValid = false;
    }
  }

  // Type Guard Implementations
  public isString(value: unknown): value is string {
    return typeof value === "string";
  }

  public isNumber(value: unknown): value is number {
    return typeof value === "number" && !isNaN(value);
  }

  public isBoolean(value: unknown): value is boolean {
    return typeof value === "boolean";
  }

  public isObject(value: unknown): value is object {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  public isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
  }

  public isDate(value: unknown): value is Date {
    return value instanceof Date && !isNaN(value.getTime());
  }

  // Helper Methods
  public validateNotEmpty<T>(
    value: T | null | undefined,
    fieldName: string,
  ): T {
    const result = this.validate(value, fieldName, { optional: false });
    if (!result.isValid) {
      this.handleValidationError(fieldName, result.errors[0]);
    }
    return value as T;
  }

  public validateType(
    value: unknown,
    expectedType: string,
    fieldName: string,
  ): void {
    const result = this.validate(value, fieldName, { type: expectedType });
    if (!result.isValid) {
      this.handleValidationError(fieldName, result.errors[0]);
    }
  }

  public validateRange(
    value: number,
    min: number,
    max: number,
    fieldName: string,
  ): void {
    const result = this.validate(value, fieldName, {
      type: "number",
      min,
      max,
    });
    if (!result.isValid) {
      this.handleValidationError(fieldName, result.errors[0]);
    }
  }

  public validateEnum<T extends string>(
    value: string,
    enumValues: readonly T[],
    fieldName: string,
  ): T {
    const result = this.validate(value, fieldName, {
      type: "string",
      customValidator: (val) => enumValues.includes(val as T),
    });
    if (!result.isValid) {
      this.handleValidationError(
        fieldName,
        `${fieldName} must be one of: ${enumValues.join(", ")}`,
        { value, allowedValues: enumValues },
      );
    }
    return value as T;
  }

  public validatePattern(
    value: string,
    pattern: RegExp,
    fieldName: string,
  ): void {
    const result = this.validate(value, fieldName, {
      type: "string",
      pattern,
    });
    if (!result.isValid) {
      this.handleValidationError(fieldName, result.errors[0]);
    }
  }
}
