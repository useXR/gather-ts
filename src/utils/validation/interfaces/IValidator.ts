export interface IValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }
  
  export interface IValidationOptions {
    optional?: boolean;
    allowEmpty?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    customValidator?: (value: any) => boolean | Promise<boolean>;
  }
  
  export interface IValidator {
    validateNotEmpty<T>(value: T | null | undefined, fieldName: string): T;
    validateType(value: unknown, expectedType: string, fieldName: string): void;
    validateRange(value: number, min: number, max: number, fieldName: string): void;
    validateArray<T>(array: T[] | null | undefined, fieldName: string, minLength?: number, maxLength?: number): void;
    validateEnum<T extends string>(value: string, enumValues: readonly T[], fieldName: string): T;
    validatePattern(value: string, pattern: RegExp, fieldName: string): void;
    validateObject<T extends object>(value: unknown, requiredFields: (keyof T)[], fieldName: string): void;
  }
  
  export interface ITypeValidator {
    isString(value: unknown): value is string;
    isNumber(value: unknown): value is number;
    isBoolean(value: unknown): value is boolean;
    isObject(value: unknown): value is object;
    isArray(value: unknown): value is unknown[];
    isDate(value: unknown): value is Date;
  }