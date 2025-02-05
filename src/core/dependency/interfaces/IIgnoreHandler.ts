// src/core/dependency/interfaces/IIgnoreHandler.ts
export interface IIgnoreHandler {
  shouldIgnore(filePath: string): boolean;
  getPatterns(): string[];
  addPattern(pattern: string): void;
  removePattern(pattern: string): boolean;
  resetPatterns(): void;
  printDebugInfo(filePath: string): void;
}

export interface IIgnoreHandlerOptions {
  debug?: boolean;
  extraPatterns?: string[];
}

export interface IPatternValidationResult {
  isValid: boolean;
  normalizedPattern?: string;
  error?: string;
}

export interface IIgnorePatternValidator {
  validatePattern(pattern: string): string;
  validateFilePath(filePath: string): void;
  parsePattern(pattern: string): IPatternValidationResult;
  validatePatterns(patterns: string[]): string[];
}