// src/core/dependency/DependencyAnalyzer.ts

import madge from "madge";
import path from "path";
import { EventEmitter } from "events";
import { DependencyAnalysisError, ValidationError } from "@/errors";
import {
  IDependencyAnalyzer,
  IDependencyAnalyzerDeps,
  IDependencyAnalyzerOptions,
  IAnalyzeOptions,
  IDependencyAnalysisResult,
  IDependencyValidationResult,
  IDependencyProgress,
  IDependencyAnalyzerEvents,
} from "./interfaces/IDependencyAnalyzer";
import { IDependencyMap } from "dependency";

export class DependencyAnalyzer
  extends EventEmitter
  implements IDependencyAnalyzer
{
  private readonly debug: boolean;
  private readonly webpackConfigPath?: string;
  private readonly tsConfigPath: string;
  private readonly fileExtensions: string[];
  private readonly maxConcurrency: number;
  private isInitialized: boolean = false;
  private originalCwd: string;

  constructor(
    private readonly deps: IDependencyAnalyzerDeps,
    options: IDependencyAnalyzerOptions = {}
  ) {
    super();
    this.debug = options.debug || false;
    this.webpackConfigPath = options.webpackConfigPath;
    this.tsConfigPath = options.tsConfigPath || "tsconfig.json";
    this.fileExtensions = options.fileExtensions || ["ts", "tsx"];
    this.maxConcurrency = options.maxConcurrency || 4;
    this.originalCwd = process.cwd();
  }

  private logDebug(message: string): void {
    if (this.debug) {
      this.deps.logger.debug(message);
    }
  }

  private handleError(operation: string, error: unknown, context?: Record<string, unknown>): never {
    const message = error instanceof Error ? error.message : String(error);
    const analysisError = new DependencyAnalysisError(
      `Dependency analysis ${operation} failed: ${message}`,
      context?.entryPoint as string,
      context?.dependencies as string[]
    );
    this.deps.logger.error(analysisError.message);
    this.emit('analysis:error', {
      error: analysisError,
      phase: operation,
      timestamp: Date.now()
    });
    throw analysisError;
  }

  public async initialize(): Promise<void> {
    this.logDebug("Initializing DependencyAnalyzer");

    try {
      if (this.isInitialized) {
        this.logDebug("DependencyAnalyzer already initialized");
        return;
      }

      // Store original working directory
      this.originalCwd = process.cwd();

      // Verify configuration files exist
      if (
        this.webpackConfigPath &&
        !this.deps.fileSystem.exists(this.webpackConfigPath)
      ) {
        this.deps.logger.warn(
          `Webpack config not found at: ${this.webpackConfigPath}`
        );
      }

      if (!this.deps.fileSystem.exists(this.tsConfigPath)) {
        this.deps.logger.warn(
          `TypeScript config not found at: ${this.tsConfigPath}`
        );
      }

      this.isInitialized = true;
      this.logDebug("DependencyAnalyzer initialization complete");
    } catch (error) {
      this.handleError("initialize", error);
    }
  }

  public cleanup(): void {
    this.logDebug("Cleaning up DependencyAnalyzer");
    this.restoreWorkingDirectory();
    this.removeAllListeners();
    this.isInitialized = false;
  }

  private changeWorkingDirectory(dir: string): void {
    this.originalCwd = process.cwd();
    process.chdir(dir);
    this.logDebug(`Changed working directory to: ${dir}`);
  }

  private restoreWorkingDirectory(): void {
    if (process.cwd() !== this.originalCwd) {
      process.chdir(this.originalCwd);
      this.logDebug(`Restored working directory to: ${this.originalCwd}`);
    }
  }

  private emitProgress(
    phase: IDependencyProgress["phase"],
    completed: number,
    total: number,
    currentFile?: string
  ): void {
    this.emit("progress", {
      phase,
      completed,
      total,
      currentFile,
    });
  }

  public async validateEntryFiles(
    entryFiles: string[],
    rootDir: string,
    options: IAnalyzeOptions = {}
  ): Promise<string[]> {
    if (!this.isInitialized) {
      throw new ValidationError("DependencyAnalyzer not initialized");
    }

    this.logDebug(`Validating ${entryFiles.length} entry files in ${rootDir}`);

    const validationResult: IDependencyValidationResult = {
      isValid: true,
      validFiles: [],
      invalidFiles: [],
      errors: [],
    };

    let processed = 0;
    const total = entryFiles.length;

    for (const file of entryFiles) {
      try {
        const resolvedPath = this.deps.fileSystem.resolvePath(
          rootDir,
          file.trim()
        );

        if (!this.deps.fileSystem.exists(resolvedPath)) {
          throw new ValidationError("Entry file not found", {
            file: resolvedPath,
          });
        }

        if (
          !options.includeNodeModules &&
          this.deps.ignoreHandler.shouldIgnore(resolvedPath)
        ) {
          throw new ValidationError("Entry file is ignored", {
            file: resolvedPath,
            ignorePatterns: this.deps.ignoreHandler.getPatterns(),
          });
        }

        validationResult.validFiles.push(resolvedPath);
        this.logDebug(`Validated entry file: ${resolvedPath}`);

        processed++;
        this.emitProgress("validation", processed, total, file);
      } catch (error) {
        validationResult.isValid = false;
        validationResult.invalidFiles.push(file);
        validationResult.errors.push({
          file,
          error: error instanceof Error ? error.message : String(error),
        });

        this.emit("warning", {
          message: `Failed to validate file: ${file}`,
          file,
          timestamp: Date.now(),
        });
      }
    }

    if (!validationResult.isValid) {
      this.handleError(
        "validate",
        new ValidationError("Entry file validation failed", {
          errors: validationResult.errors,
          invalidFiles: validationResult.invalidFiles,
        })
      );
    }

    return validationResult.validFiles;
  }

  public async analyzeDependencies(
    entryFiles: string | string[],
    projectRoot: string,
    options: IAnalyzeOptions = {}
  ): Promise<IDependencyAnalysisResult> {
    if (!this.isInitialized) {
      throw new ValidationError("DependencyAnalyzer not initialized");
    }

    const startTime = Date.now();
    const files = Array.isArray(entryFiles) ? entryFiles : [entryFiles];

    if (options.useWorkingDir) {
      this.changeWorkingDirectory(projectRoot);
    }

    try {
      this.emit("analysis:start", {
        entryFiles: files,
        timestamp: startTime,
      });

      const relativeFiles = files.map((file) =>
        this.deps.fileSystem.getRelativePath(projectRoot, file)
      );

      this.logDebug(`Analyzing dependencies for: ${relativeFiles.join(", ")}`);

      // Check cache if enabled
      if (!options.skipCache && this.deps.cache) {
        const cacheKey = this.getCacheKey(relativeFiles, projectRoot);
        const cachedDeps = this.deps.cache.get(cacheKey);

        if (cachedDeps) {
          const result = {
            entryFiles: files,
            dependencies: cachedDeps,
            circularDependencies: await this.getCircularDependencies(
              cachedDeps
            ),
            totalFiles: Object.keys(cachedDeps).length,
            analysisTime: Date.now() - startTime,
          };

          this.logDebug("Returned cached dependency analysis");
          return result;
        }
      }

      const ignorePatterns = this.deps.ignoreHandler
        .getPatterns()
        .map(
          (pattern) =>
            new RegExp(
              pattern
                .replace(/\./g, "\\.")
                .replace(/\*\*/g, ".*")
                .replace(/\*/g, "[^/]*")
                .replace(/\?/g, ".")
            )
        );

      const madgeConfig = {
        baseDir: projectRoot,
        tsConfig: this.deps.fileSystem.joinPath(projectRoot, this.tsConfigPath),
        fileExtensions: this.fileExtensions,
        excludeRegExp: options.includeNodeModules
          ? []
          : [/node_modules/, ...ignorePatterns],
        detectiveOptions: {
          ts: { mixedImports: true },
          tsx: { mixedImports: true },
        },
        followSymlinks: options.followSymlinks || false,
        ...options.madgeConfig,
      };

      let processedFiles = 0;
      const dependencyMaps = await Promise.all(
        relativeFiles.map(async (entryFile) => {
          this.logDebug(`Processing dependencies for: ${entryFile}`);
          this.emitProgress(
            "analysis",
            ++processedFiles,
            relativeFiles.length,
            entryFile
          );

          const madgeResult = await madge(entryFile, madgeConfig);
          return await madgeResult.obj();
        })
      );

      const dependencies: IDependencyMap = {};
      let totalFiles = 0;

      dependencyMaps.forEach((deps) => {
        Object.entries(deps).forEach(([file, fileDeps]) => {
          const absFile = this.deps.fileSystem.resolvePath(projectRoot, file);

          if (
            options.includeNodeModules ||
            !this.deps.ignoreHandler.shouldIgnore(absFile)
          ) {
            const validDeps = fileDeps
              .map((dep) => this.deps.fileSystem.resolvePath(projectRoot, dep))
              .filter(
                (dep) =>
                  options.includeNodeModules ||
                  !this.deps.ignoreHandler.shouldIgnore(dep)
              );

            if (validDeps.length > 0) {
              dependencies[absFile] = Array.from(
                new Set([...(dependencies[absFile] || []), ...validDeps])
              );
              totalFiles++;
            }
          }
        });
      });

      // Cache the result if enabled
      if (!options.skipCache && this.deps.cache) {
        const cacheKey = this.getCacheKey(relativeFiles, projectRoot);
        this.deps.cache.set(cacheKey, dependencies);
      }

      const circularDependencies = await this.getCircularDependencies(
        dependencies
      );

      const result: IDependencyAnalysisResult = {
        entryFiles: files,
        dependencies,
        circularDependencies,
        totalFiles,
        analysisTime: Date.now() - startTime,
        warnings:
          circularDependencies.length > 0
            ? [`Found ${circularDependencies.length} circular dependencies`]
            : undefined,
      };

      this.emit("analysis:complete", {
        result,
        timestamp: Date.now(),
      });

      this.logDebug(
        `Analysis complete: ${totalFiles} files, ` +
          `${circularDependencies.length} circular dependencies, ` +
          `${result.analysisTime}ms`
      );

      return result;
    } catch (error) {
      this.handleError("analyze", error, {
        entryPoint: Array.isArray(entryFiles) ? entryFiles[0] : entryFiles,
        dependencies: Array.isArray(entryFiles) ? entryFiles : [entryFiles],
      });
    } finally {
      if (options.useWorkingDir) {
        this.restoreWorkingDirectory();
      }
    }
    // This return will never be reached because handleError always throws,
    // but TypeScript needs it to understand all paths return something
    return Promise.reject(new Error('Unreachable'));
  }

  public async gatherDependencies(
    adjacencyList: IDependencyMap,
    entryFiles: string[],
    maxDepth?: number
  ): Promise<string[]> {
    if (!this.isInitialized) {
      throw new ValidationError("DependencyAnalyzer not initialized");
    }

    this.logDebug(
      `Gathering dependencies with max depth: ${maxDepth || "unlimited"}`
    );

    const queue: Array<{ file: string; depth: number }> = [];
    const visited = new Set<string>();
    let processed = 0;
    const total = Object.keys(adjacencyList).length;

    for (const file of entryFiles) {
      if (!this.deps.ignoreHandler.shouldIgnore(file)) {
        queue.push({ file, depth: 0 });
        visited.add(file);
        this.logDebug(`Added entry file to queue: ${file}`);
      }
    }

    while (queue.length > 0) {
      const { file, depth } = queue.shift()!;
      if (maxDepth !== undefined && depth >= maxDepth) {
        this.logDebug(`Skipping ${file} - max depth (${maxDepth}) reached`);
        continue;
      }

      const children = adjacencyList[file] || [];
      for (const child of children) {
        if (
          !this.deps.ignoreHandler.shouldIgnore(child) &&
          !visited.has(child)
        ) {
          visited.add(child);
          queue.push({ file: child, depth: depth + 1 });
          this.logDebug(`Added dependency: ${child} (depth: ${depth + 1})`);
        }
      }

      processed++;
      this.emitProgress("gathering", processed, total, file);
    }

    const result = Array.from(visited);
    this.logDebug(`Gathered ${result.length} total dependencies`);
    return result;
  }

  public async getCircularDependencies(
    dependencyMap: IDependencyMap
  ): Promise<string[][]> {
    this.logDebug("Analyzing circular dependencies");

    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (node: string, path: string[] = []): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const dependencies = dependencyMap[node] || [];
      for (const dependency of dependencies) {
        if (!visited.has(dependency)) {
          dfs(dependency, [...path]);
        } else if (recursionStack.has(dependency)) {
          const cycleStart = path.indexOf(dependency);
          const cycle = path.slice(cycleStart);
          if (
            !cycles.some(
              (existing) =>
                existing.length === cycle.length &&
                existing.every((value, index) => value === cycle[index])
            )
          ) {
            cycles.push(cycle);
            this.emit("warning", {
              message: `Found circular dependency: ${cycle.join(" -> ")}`,
              timestamp: Date.now(),
            });
          }
        }
      }

      recursionStack.delete(node);
      path.pop();
    };

    for (const node of Object.keys(dependencyMap)) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    if (cycles.length > 0) {
      this.logDebug(`Found ${cycles.length} circular dependencies`);
      cycles.forEach((cycle, index) => {
        this.logDebug(`Cycle ${index + 1}: ${cycle.join(" -> ")}`);
      });
    }

    return cycles;
  }

  private getCacheKey(relativeFiles: string[], projectRoot: string): string {
    const content = JSON.stringify({
      files: relativeFiles.sort(), // Sort for consistent keys
      root: projectRoot,
      extensions: this.fileExtensions,
      config: {
        tsConfig: this.tsConfigPath,
        webpackConfig: this.webpackConfigPath,
      },
    });

    return require("crypto").createHash("md5").update(content).digest("hex");
  }
}
