// src/core/dependency/interfaces/IDependencyAnalyzer.ts
import { IDependencyMap } from '@/types/compiler';

export interface IDependencyAnalyzer {
  analyzeDependencies(entryFiles: string | string[], projectRoot: string): Promise<IDependencyMap>;
  gatherDependencies(deps: IDependencyMap, entryFiles: string[], maxDepth?: number): Promise<string[]>;
  validateEntryFiles(entryFiles: string[], rootDir: string): Promise<string[]>;
}