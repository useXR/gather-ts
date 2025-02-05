import { ValidationError } from '@/errors';
import { IValidator, ITypeValidator, IValidationOptions, IValidationResult } from './interfaces/IValidator';

export class Validator implements IValidator, ITypeValidator {
  public validateNotEmpty<T>(value: T | null | undefined, fieldName: string): T {
    if (value === null || value === undefined) {
      throw new ValidationError(`${fieldName} cannot be null or undefined`);
    }
    
    if (typeof value === 'string' && value.trim() === '') {
      throw new ValidationError(`${fieldName} cannot be empty`);
    }
    
    return value;
  }

  public validateType(value: unknown, expectedType: string, fieldName: string): void {
    if (expectedType === 'array' && !this.isArray(value)) {
      throw new ValidationError(
        `Invalid type for ${fieldName}`,
        {
          providedValue: value,
          expectedType,
          actualType: typeof value
        }
      );
    }

    if (typeof value !== expectedType) {
      throw new ValidationError(
        `Invalid type for ${fieldName}`,
        {
          providedValue: value,
          expectedType,
          actualType: typeof value
        }
      );
    }
  }

  public validateRange(value: number, min: number, max: number, fieldName: string): void {
    this.validateType(value, 'number', fieldName);
    
    if (value < min || value > max) {
      throw new ValidationError(
        `${fieldName} must be between ${min} and ${max}`,
        {
          providedValue: value,
          min,
          max
        }
      );
    }
  }

  public validateArray<T>(
    array: T[] | null | undefined,
    fieldName: string,
    minLength?: number,
    maxLength?: number
  ): void {
    if (!this.isArray(array)) {
      throw new ValidationError(
        `${fieldName} must be an array`,
        {
          providedValue: array,
          expectedType: 'array'
        }
      );
    }

    if (minLength !== undefined && array.length < minLength) {
      throw new ValidationError(
        `${fieldName} must have at least ${minLength} items`,
        {
          providedValue: array.length,
          minLength
        }
      );
    }

    if (maxLength !== undefined && array.length > maxLength) {
      throw new ValidationError(
        `${fieldName} must have at most ${maxLength} items`,
        {
          providedValue: array.length,
          maxLength
        }
      );
    }
  }

  public validateEnum<T extends string>(
    value: string,
    enumValues: readonly T[],
    fieldName: string
  ): T {
    if (!enumValues.includes(value as T)) {
      throw new ValidationError(
        `Invalid value for ${fieldName}`,
        {
          providedValue: value,
          allowedValues: Array.from(enumValues)
        }
      );
    }
    return value as T;
  }

  public validatePattern(value: string, pattern: RegExp, fieldName: string): void {
    this.validateType(value, 'string', fieldName);

    if (!pattern.test(value)) {
      throw new ValidationError(
        `Invalid format for ${fieldName}`,
        {
          providedValue: value,
          pattern: pattern.toString()
        }
      );
    }
  }

  public validateObject<T extends object>(
    value: unknown,
    requiredFields: (keyof T)[],
    fieldName: string
  ): void {
    if (!this.isObject(value)) {
      throw new ValidationError(
        `${fieldName} must be an object`,
        {
          providedValue: value,
          expectedType: 'object'
        }
      );
    }

    const missingFields = requiredFields.filter(field => !(field in value));
    if (missingFields.length > 0) {
      throw new ValidationError(
        `Missing required fields in ${fieldName}`,
        {
          missingFields
        }
      );
    }
  }

  // Type guard implementations
  public isString(value: unknown): value is string {
    return typeof value === 'string';
  }

  public isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
  }

  public isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
  }

  public isObject(value: unknown): value is object {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  public isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
  }

  public isDate(value: unknown): value is Date {
    return value instanceof Date && !isNaN(value.getTime());
  }

  // Validation with options
  public validate<T>(
    value: unknown,
    fieldName: string,
    options: IValidationOptions = {}
  ): IValidationResult {
    const result: IValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Handle optional fields
      if (value === undefined || value === null) {
        result.isValid = options.optional ?? false; // Use nullish coalescing
        if (!options.optional) {
          result.errors.push(`${fieldName} is required`);
        }
        return result;
      }

      // Handle empty values
      if (typeof value === 'string' && value.trim() === '') {
        if (!options.allowEmpty) {
          result.errors.push(`${fieldName} cannot be empty`);
          result.isValid = false;
          return result;
        }
      }

      // Length validations for strings and arrays
      if ((typeof value === 'string' || Array.isArray(value))) {
        const length = (value as string | unknown[]).length;
        
        if (options.minLength !== undefined && length < options.minLength) {
          result.errors.push(`${fieldName} must be at least ${options.minLength} characters long`);
        }
        
        if (options.maxLength !== undefined && length > options.maxLength) {
          result.errors.push(`${fieldName} must not exceed ${options.maxLength} characters`);
        }
      }

      // Pattern validation for strings
      if (typeof value === 'string' && options.pattern) {
        if (!options.pattern.test(value)) {
          result.errors.push(`${fieldName} has an invalid format`);
        }
      }

      // Custom validation
      if (options.customValidator) {
        const customValidationResult = options.customValidator(value);
        if (customValidationResult instanceof Promise) {
          throw new Error('Async validators are not supported in synchronous validate method');
        }
        if (!customValidationResult) {
          result.errors.push(`${fieldName} failed custom validation`);
        }
      }

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    result.isValid = result.errors.length === 0;
    return result;
  }
}

// Export a default instance
export const validator = new Validator();