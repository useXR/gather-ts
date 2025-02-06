// src/errors/interfaces/IError.ts

import { IService } from '@/types/services';
import { ILogger } from '@/utils/logging/interfaces/ILogger';
import { IFileSystem } from '@/utils/filesystem/interfaces/IFileSystem';
import { IErrorUtils } from './IErrorUtils';

// Common types
export interface IErrorDetails {
  [key: string]: unknown;
}

export interface IBaseError extends Error {
  readonly details?: IErrorDetails;
}

export interface IErrorClassification {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: IErrorDetails;
  stackTrace?: string;
}

export interface IErrorTransformation {
  condition: (error: Error) => boolean;
  transform: (error: Error) => Error;
}

export interface IErrorMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  totalWarnings: number;
  startTime: number;
  lastErrorTime?: number;
}