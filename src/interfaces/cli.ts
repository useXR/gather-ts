// src/interfaces/cli.ts

import { ICompileOptions } from '@/types/compiler';
import { IService } from '@/types/services';
import { ILogger } from '@/utils/logging/interfaces/ILogger';
import { IConfigManager } from '@/config/interfaces/IConfigManager';
import { ICompileContext } from '@/core/compiler/interfaces/ICompileContext';
import { IArgumentParser } from '@/core/compiler/interfaces/IArgumentParser';
import { IFileSystem } from '@/utils';

export interface ICLIDeps {
  logger: ILogger;
  configManager: IConfigManager;
  compiler: ICompileContext;
  argumentParser: IArgumentParser;
  fileSystem: IFileSystem;
}

export interface ICLIOptions {
  debug?: boolean;
  defaultConfig?: boolean;
  exitOnError?: boolean;
}

export interface ICLIResult {
  success: boolean;
  exitCode: number;
  output?: string;
  error?: Error;
  metrics?: ICLIMetrics;
}

export interface ICLIMetrics {
  executionTime: number;
  memoryUsage: number;
  filesProcessed: number;
  errors: number;
  warnings: number;
}

export interface ICLIProgress {
  phase: string;
  completed: number;
  total: number;
  message?: string;
}

export interface ICLIEventMap {
  'command:start': {
    command: string;
    options: ICompileOptions;
    timestamp: number;
  };
  'command:complete': {
    command: string;
    result: ICLIResult;
    timestamp: number;
  };
  'error': {
    error: Error;
    command?: string;
    timestamp: number;
  };
  'warning': {
    message: string;
    command?: string;
    timestamp: number;
  };
  'progress': ICLIProgress;
}

export interface ICLI extends IService {
  run(): Promise<ICLIResult>;
  
  on<K extends keyof ICLIEventMap>(
    event: K,
    listener: (data: ICLIEventMap[K]) => void
  ): this;
  
  off<K extends keyof ICLIEventMap>(
    event: K,
    listener: (data: ICLIEventMap[K]) => void
  ): this;
  
  emit<K extends keyof ICLIEventMap>(
    event: K,
    data: ICLIEventMap[K]
  ): boolean;
}