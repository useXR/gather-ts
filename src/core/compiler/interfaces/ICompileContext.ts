import { ICompileOptions, ICompileResult, IDependencyMap } from '@/types/compiler';
import { IFileInfo, IFileWithContent } from '@/types/files';
import { ISummaryStats } from '@/types/stats';
import { IConfigManager } from '@/config/interfaces/IConfigManager';

export interface ICompileContext {
  processRequiredFiles(relativeFiles: IFileInfo[], rootDir: string): Promise<IFileInfo[]>;
  generateOutput(filesWithContent: IFileWithContent[], configHandler: IConfigManager, maxDepth?: number): Promise<string>;
  generateSummary(files: IFileWithContent[], stats: ISummaryStats, options: IOutputOptions): string;
  compile(options: ICompileOptions): Promise<ICompileResult>;
}

export interface IOutputOptions {
  includeSummary: boolean;
  includeUsageGuidelines: boolean;
  includeStats: boolean;
  includeGenerationTime: boolean;
}

export interface ICompilePhaseResult {
  phase: string;
  success: boolean;
  error?: Error;
  data?: unknown;
}