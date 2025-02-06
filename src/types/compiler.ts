import { IMetadata } from './common';
import { IDependencyMap } from './dependency';

export interface ICompileOptions {
  /**
   * Array of entry file paths to analyze
   */
  entryFiles: string[];

  /**
   * Output file path
   */
  outputFile: string;

  /**
   * Project root directory
   */
  rootDir?: string;

  /**
   * Maximum depth for dependency analysis
   */
  maxDepth?: number;

  /**
   * Custom configuration overrides
   */
  config?: Record<string, unknown>;

  /**
   * Whether to collect and include metrics
   */
  includeMetrics?: boolean;

  /**
   * Batch size for processing files
   */
  batchSize?: number;

  /**
   * File encoding
   */
  encoding?: BufferEncoding;

  /**
   * Patterns to ignore
   */
  ignorePatterns?: string[];

  /**
   * Required files to include
   */
  requiredFiles?: string[];

  /**
   * Initialize configuration
   */
  init?: boolean;

  /**
   * Enable debug mode
   */
  debug?: boolean;
}

export interface ICompileResult {
  /**
   * Number of files processed
   */
  filesProcessed: number;

  /**
   * Path to the output file
   */
  outputPath: string;

  /**
   * Total number of tokens in processed files
   */
  totalTokens: number;

  /**
   * Timestamp when the result was generated
   */
  generationTime: string;

  /**
   * Number of required files processed (if any)
   */
  requiredFilesProcessed?: number;

  /**
   * Number of files skipped during processing
   */
  skippedFiles?: number;

  /**
   * Compilation metrics (if enabled)
   */
  metrics?: ICompileMetrics;

  /**
   * Metadata about the compilation
   */
  metadata: IMetadata;
}

export interface ICompilationStats {
  /**
   * Timestamp when compilation started
   */
  startTime: string;

  /**
   * Timestamp when compilation ended
   */
  endTime: string;

  /**
   * Total duration in milliseconds
   */
  duration: number;

  /**
   * Total number of files processed
   */
  totalFiles: number;

  /**
   * Number of files successfully processed
   */
  processedFiles: number;

  /**
   * Number of files skipped
   */
  skippedFiles: number;

  /**
   * Total number of tokens processed
   */
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

export interface ICompileMetrics {
  /**
   * Number of files processed
   */
  filesProcessed: number;

  /**
   * Total number of tokens processed
   */
  totalTokens: number;

  /**
   * Total processing time in milliseconds
   */
  processingTime: number;

  /**
   * Peak memory usage in bytes
   */
  memoryUsage: number;

  /**
   * Time spent on dependency analysis in milliseconds
   */
  dependencyAnalysisTime: number;

  /**
   * Time spent on tokenization in milliseconds
   */
  tokenizationTime: number;

  /**
   * Time spent on output generation in milliseconds
   */
  outputGenerationTime: number;

  /**
   * Number of errors encountered
   */
  errors: number;

  /**
   * Number of warnings encountered
   */
  warnings: number;
}