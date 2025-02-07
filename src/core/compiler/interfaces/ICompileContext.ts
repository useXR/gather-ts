// src/core/compiler/interfaces/ICompileContext.ts

import { IService } from '@/types/services';
import { ICompileMetrics, ICompileOptions, ICompileResult } from '@/types/compiler';
import { EventEmitter } from 'events';
import { IConfigManager } from '@/config';
import { IIgnoreHandler, IDependencyAnalyzer } from '@/core/dependency';
import { ITokenCounter } from '@/core/tokenization';
import { IErrorHandler } from '@/errors/interfaces/IErrorHandler';
import { ILogger, IFileSystem } from '@/utils';
import { ITemplateManager } from '@/core/templating/interfaces/ITemplateManager';

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
  templateManager: ITemplateManager;
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

export interface ICompileContext extends IService {
  // Add Service interface methods
  isInitialized: boolean;
  initialize(): Promise<void>;
  cleanup(): void;

  // Add existing compile methods
  compile(options: ICompileOptions): Promise<ICompileResult>;
  getMetrics(): ICompileMetrics;

  // Add event emitter methods
  on(event: 'progress', listener: (progress: ICompileProgress) => void): this;
  off(event: 'progress', listener: (progress: ICompileProgress) => void): this;
  emit(event: 'progress', progress: ICompileProgress): boolean;
}