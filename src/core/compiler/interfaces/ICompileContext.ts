// src/core/compiler/interfaces/ICompileContext.ts

import { EventEmitter } from 'events';
import { ICompileMetrics, ICompileOptions, ICompileResult } from '@/types/compiler';
import { IService } from '@/types/services';
import { IConfigManager } from '@/config/interfaces/IConfigManager';
import { IIgnoreHandler } from '@/core/dependency/interfaces/IIgnoreHandler';
import { ITokenCounter } from '@/core/tokenization/interfaces/ITokenCounter';
import { IErrorHandler } from '@/errors/interfaces/IErrorHandler';
import { IDependencyAnalyzer } from '@/core/dependency/interfaces/IDependencyAnalyzer';
import { ILogger } from '@/utils/logging/interfaces/ILogger';
import { IFileSystem } from '@/utils/filesystem/interfaces/IFileSystem';

export type CompilePhase = 
  | 'initialization'
  | 'dependency-analysis'
  | 'file-processing'
  | 'tokenization'
  | 'output-generation'
  | 'completion';

export interface ICompileContextDeps {
  configManager: IConfigManager;
  ignoreHandler: IIgnoreHandler;
  tokenCounter: ITokenCounter;
  errorHandler: IErrorHandler;
  dependencyAnalyzer: IDependencyAnalyzer;
  logger: ILogger;
  fileSystem: IFileSystem;
}

export interface ICompilePhaseResult {
  phase: string;
  success: boolean;
  error?: Error;
  data?: unknown;
  metrics?: {
    startTime: number;
    endTime: number;
    duration: number;
    memoryUsage: number;
  };
}

export interface ICompileFileOptions {
  encoding?: BufferEncoding;
  validateContent?: boolean;
  maxSize?: number;
}

export interface ICompileProgress {
  phase: CompilePhase;
  completed: number;
  total: number;
  message?: string;
}

export interface ICompileContextEvents {
  'phase:start': { phase: string; timestamp: number };
  'phase:end': { phase: string; timestamp: number; result: ICompilePhaseResult };
  'error': { error: Error; phase?: string };
  'warning': { message: string; phase?: string };
  'progress': ICompileProgress;
}

export interface ICompileContextOptions {
  debug?: boolean;
  batchSize?: number;
  includeMetrics?: boolean;
  maxConcurrency?: number;
  hooks?: ICompileContextHooks;
}

export interface ICompileContextHooks {
  beforeCompile?: (options: ICompileOptions) => Promise<void>;
  afterCompile?: (result: ICompileResult) => Promise<void>;
  onError?: (error: Error) => Promise<void>;
  beforePhase?: (phase: string) => Promise<void>;
  afterPhase?: (phase: string, result: ICompilePhaseResult) => Promise<void>;
}

export interface ICompileContext extends IService, EventEmitter {
  compile(options: ICompileOptions): Promise<ICompileResult>;
  getMetrics(): ICompileMetrics;
  
  on<K extends keyof ICompileContextEvents>(
    event: K,
    listener: (data: ICompileContextEvents[K]) => void
  ): this;
  
  off<K extends keyof ICompileContextEvents>(
    event: K,
    listener: (data: ICompileContextEvents[K]) => void
  ): this;
  
  emit<K extends keyof ICompileContextEvents>(
    event: K,
    data: ICompileContextEvents[K]
  ): boolean;
}