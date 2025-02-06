// src/utils/logging/interfaces/ILogger.ts

import { IService } from '@/types/services';

export interface ILogColors {
  reset: string;
  bright: string;
  dim: string;
  blue: string;
  green: string;
  yellow: string;
  red: string;
  gray: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ILoggerOptions {
  /** Enable debug mode */
  enableDebug?: boolean;
  /** Custom colors */
  colors?: Partial<ILogColors>;
  /** Include timestamps */
  timestamp?: boolean;
  /** Minimum log level */
  logLevel?: LogLevel;
}

export interface ILoggerDeps {
  outputStream: NodeJS.WriteStream;
  errorStream: NodeJS.WriteStream;
}

export interface ILogger extends IService {
  /** Log informational message */
  info(message: string): void;
  
  /** Log success message */
  success(message: string): void;
  
  /** Log warning message */
  warn(message: string): void;
  
  /** Log error message */
  error(message: string): void;
  
  /** Log debug message */
  debug(message: string): void;
  
  /** Log section header */
  section(title: string): void;
  
  /** Log summary with stats */
  summary(title: string, stats: Record<string, any>): void;
  
  /** Enable debug logging */
  enableDebug(): void;
  
  /** Check if debug is enabled */
  isDebugEnabled(): boolean;
}