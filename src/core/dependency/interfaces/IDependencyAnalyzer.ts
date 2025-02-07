// src/core/dependency/interfaces/IDependencyAnalyzer.ts

import { IService } from "@/types/services";
import { IFileSystem } from "@/utils/filesystem/interfaces/IFileSystem";
import { ILogger } from "@/utils/logging/interfaces/ILogger";
import { IIgnoreHandler } from "./IIgnoreHandler";
import { IDependencyCache } from "./IDependencyCache";
import { EventEmitter } from "events";
import { IDependencyMap } from "@/types";

export interface IDependencyAnalyzerDeps {
  fileSystem: IFileSystem;
  logger: ILogger;
  ignoreHandler: IIgnoreHandler;
  cache?: IDependencyCache;
}

export interface IDependencyAnalyzerOptions {
  debug?: boolean;
  webpackConfigPath?: string;
  tsConfigPath?: string;
  fileExtensions?: string[];
  maxConcurrency?: number;
}

export interface IAnalyzeOptions {
  skipCache?: boolean;
  useWorkingDir?: boolean;
  madgeConfig?: Record<string, unknown>;
  includeNodeModules?: boolean;
  followSymlinks?: boolean;
  maxDepth?: number;
}

export interface IDependencyValidationResult {
  isValid: boolean;
  validFiles: string[];
  invalidFiles: string[];
  errors: Array<{
    file: string;
    error: string;
  }>;
}

export interface IDependencyAnalysisResult {
  entryFiles: string[];
  dependencies: IDependencyMap;
  circularDependencies: string[][];
  totalFiles: number;
  analysisTime: number;
  warnings?: string[];
}

export interface IDependencyProgress {
  phase: "validation" | "analysis" | "gathering";
  completed: number;
  total: number;
  currentFile?: string;
}

export interface IDependencyAnalyzerEvents {
  "analysis:start": { entryFiles: string[]; timestamp: number };
  "analysis:complete": { result: IDependencyAnalysisResult; timestamp: number };
  "analysis:error": { error: Error; phase: string; timestamp: number };
  progress: IDependencyProgress;
  warning: { message: string; file?: string; timestamp: number };
}

export interface IDependencyAnalyzer extends IService, EventEmitter {
  validateEntryFiles(
    entryFiles: string[],
    rootDir: string,
    options?: IAnalyzeOptions,
  ): Promise<string[]>;

  analyzeDependencies(
    entryFiles: string | string[],
    projectRoot: string,
    options?: IAnalyzeOptions,
  ): Promise<IDependencyAnalysisResult>;

  gatherDependencies(
    deps: IDependencyMap,
    entryFiles: string[],
    maxDepth?: number,
  ): Promise<string[]>;

  getCircularDependencies(dependencyMap: IDependencyMap): Promise<string[][]>;

  on<K extends keyof IDependencyAnalyzerEvents>(
    event: K,
    listener: (data: IDependencyAnalyzerEvents[K]) => void,
  ): this;

  off<K extends keyof IDependencyAnalyzerEvents>(
    event: K,
    listener: (data: IDependencyAnalyzerEvents[K]) => void,
  ): this;

  emit<K extends keyof IDependencyAnalyzerEvents>(
    event: K,
    data: IDependencyAnalyzerEvents[K],
  ): boolean;
}
