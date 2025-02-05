import { IMetadata } from './common';

export interface ICompileOptions {
  entryFiles: string[];
  outputFile: string;
  rootDir?: string;
  maxDepth?: number;
}

export interface IDependencyMap {
  [key: string]: string[];
}

export interface ICompileResult {
  filesProcessed: number;
  outputPath: string;
  totalTokens: number;
  generationTime: string;
  requiredFilesProcessed?: number;
  skippedFiles?: number;
  metadata: IMetadata;
}

export interface ICompilationStats {
  startTime: string;
  endTime: string;
  duration: number;
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  totalTokens: number;
}

export interface ICompileContext {
  options: ICompileOptions;
  stats: ICompilationStats;
  dependencies: IDependencyMap;
}

export type CompilePhase = 
  | 'initialization'
  | 'dependency-analysis'
  | 'file-processing'
  | 'tokenization'
  | 'output-generation'
  | 'completion';