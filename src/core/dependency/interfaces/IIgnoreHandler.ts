// src/core/dependency/interfaces/IIgnoreHandler.ts

import { IFileSystem } from '@/utils/filesystem/interfaces/IFileSystem';
import { ILogger } from '@/utils/logging/interfaces/ILogger';
import { IService } from '@/types/services';

export interface IIgnoreHandlerDeps {
  fileSystem: IFileSystem;
  logger: ILogger;
}

export interface IIgnoreHandlerOptions {
  debug?: boolean;
  extraPatterns?: string[];
}

export interface ILoadPatternsOptions {
  skipGitignore?: boolean;
  validate?: boolean;
}

export interface IIgnoreHandler extends IService {
  // Core functionality
  shouldIgnore(filePath: string): boolean;
  validateFilePath(filePath: string): void;

  // Pattern management
  getPatterns(): string[];
  addPattern(pattern: string): void;
  removePattern(pattern: string): boolean;
  resetPatterns(): void;

  // Debug utilities
  printDebugInfo(filePath: string): void;

  // Lifecycle methods
  initialize(): Promise<void>;
  cleanup(): void;
}

export interface IPatternValidationResult {
  isValid: boolean;
  normalizedPattern?: string;
  error?: string;
}

export interface IIgnorePatternValidator {
  validatePattern(pattern: string): string;
  parsePattern(pattern: string): IPatternValidationResult;
  validatePatterns(patterns: string[]): string[];
}