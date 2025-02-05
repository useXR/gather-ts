import { IFileStats } from './files';

export interface ISummaryStats {
  totalFiles: number;
  totalChars: number;
  totalTokens: number;
  topFiles: IFileStats[];
  generationTime: string;
  averageTokensPerFile?: number;
  maxTokensInFile?: number;
  minTokensInFile?: number;
  tokenDistribution?: ITokenDistribution;
}

export interface ITokenDistribution {
  ranges: ITokenRange[];
  average: number;
  median: number;
  standardDeviation: number;
}

export interface ITokenRange {
  min: number;
  max: number;
  count: number;
  percentage: number;
}

export interface IProcessingStats {
  processedFiles: number;
  skippedFiles: number;
  errorFiles: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
}

export interface IPerformanceMetrics {
  tokenizationTime: number;
  compressionRatio: number;
  memoryUsage: number;
  processingSpeed: number; // files per second
}