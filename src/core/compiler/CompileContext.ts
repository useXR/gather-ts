import path from "path";
import { EventEmitter } from "events";

import { ValidationError } from "@/errors";
import { IFileInfo, IFileWithContent } from "@/types/files";
import {
  ICompileMetrics,
  ICompileOptions,
  ICompileResult,
} from "@/types/compiler";
import {
  CompilePhase,
  ICompileContext,
  ICompileContextDeps,
  ICompileContextOptions,
  ICompileFileOptions,
  ICompilePhaseResult,
} from "./interfaces/ICompileContext";
import { IConfigManager } from "@/config";
import { IDependencyMap } from "dependency";

export class CompileContext extends EventEmitter implements ICompileContext {
  public isInitialized: boolean = false;
  private readonly debug: boolean;
  private readonly batchSize: number;
  private readonly includeMetrics: boolean;
  private startTime: number;
  private currentPhase?: CompilePhase;

  public readonly options: ICompileOptions;
  public readonly stats: {
    startTime: string;
    endTime: string;
    duration: number;
    totalFiles: number;
    processedFiles: number;
    skippedFiles: number;
    totalTokens: number;
  };
  public readonly dependencies: IDependencyMap;

  private metrics: ICompileMetrics = {
    filesProcessed: 0,
    totalTokens: 0,
    processingTime: 0,
    memoryUsage: 0,
    dependencyAnalysisTime: 0,
    tokenizationTime: 0,
    outputGenerationTime: 0,
    errors: 0,
    warnings: 0,
  };

  constructor(
    private readonly deps: ICompileContextDeps,
    options: ICompileContextOptions = {},
  ) {
    super();
    this.debug = options.debug || false;
    this.batchSize = options.batchSize || 100;
    this.includeMetrics = options.includeMetrics || false;
    this.startTime = Date.now();

    this.options = {
      entryFiles: [],
      outputFile: "",
      rootDir: "",
    };

    this.stats = {
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: 0,
      totalFiles: 0,
      processedFiles: 0,
      skippedFiles: 0,
      totalTokens: 0,
    };

    this.dependencies = {};
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logDebug("CompileContext already initialized");
      return;
    }

    this.logDebug("Initializing CompileContext");

    try {
      // Initialize all required services
      await Promise.all([
        this.deps.ignoreHandler.initialize?.(),
        this.deps.tokenCounter.initialize?.(),
        this.deps.dependencyAnalyzer.initialize?.(),
      ]);

      this.startTime = Date.now();
      this.isInitialized = true;
      this.logDebug("CompileContext initialization complete");
    } catch (error) {
      this.handleError("initialization", error);
    }
  }

  public cleanup(): void {
    this.logDebug("Cleaning up CompileContext");

    // Cleanup all services
    this.deps.ignoreHandler.cleanup?.();
    this.deps.tokenCounter.cleanup?.();
    this.deps.dependencyAnalyzer.cleanup?.();

    this.removeAllListeners();
    this.isInitialized = false;
  }

  private logDebug(message: string): void {
    if (this.debug) {
      this.deps.logger.debug(`[CompileContext] ${message}`);
    }
  }

  private handleError(phase: string, error: unknown): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.metrics.errors++;
    this.emit("error", { error: error as Error, phase });
    throw new ValidationError(`Error in ${phase} phase: ${errorMessage}`);
  }

  private updateMetrics(update: Partial<ICompileMetrics>): void {
    Object.assign(this.metrics, update);
    this.metrics.processingTime = Date.now() - this.startTime;
    this.metrics.memoryUsage = process.memoryUsage().heapUsed;
  }

  private resetMetrics(): void {
    this.metrics = {
      filesProcessed: 0,
      totalTokens: 0,
      processingTime: 0,
      memoryUsage: 0,
      dependencyAnalysisTime: 0,
      tokenizationTime: 0,
      outputGenerationTime: 0,
      errors: 0,
      warnings: 0,
    };
    this.startTime = Date.now();
  }

  private emitProgress(
    completed: number,
    total: number,
    message?: string,
  ): void {
    if (!this.currentPhase) return;

    this.emit("progress", {
      phase: this.currentPhase,
      completed,
      total,
      message,
    });
  }

  private async executePhase<T>(
    phase: CompilePhase,
    executor: () => Promise<T>,
  ): Promise<T> {
    const startTime = Date.now();
    this.currentPhase = phase;

    try {
      this.emit("phase:start", { phase, timestamp: startTime });
      const result = await executor();

      const endTime = Date.now();
      const phaseResult: ICompilePhaseResult = {
        phase,
        success: true,
        data: result,
        metrics: {
          startTime,
          endTime,
          duration: endTime - startTime,
          memoryUsage: process.memoryUsage().heapUsed,
        },
      };

      this.emit("phase:end", {
        phase,
        timestamp: endTime,
        result: phaseResult,
      });
      return result;
    } catch (error) {
      this.handleError(phase, error);
    } finally {
      this.currentPhase = undefined;
    }
  }

  public async compile(options: ICompileOptions): Promise<ICompileResult> {
    if (!this.isInitialized) {
      throw new ValidationError("CompileContext not initialized");
    }

    // Update the options property with the provided options
    Object.assign(this.options, options);

    this.resetMetrics();
    this.logDebug("Starting compilation");

    try {
      const rootDir =
        options.rootDir || this.deps.configManager.getProjectRoot();

      // Validate entry files
      const entryFiles = await this.executePhase("initialization", async () => {
        return await this.deps.dependencyAnalyzer.validateEntryFiles(
          options.entryFiles,
          rootDir,
        );
      });

      // Analyze dependencies
      const dependencyAnalysis = await this.executePhase(
        "dependency-analysis",
        async () => {
          const startTime = Date.now();
          const result = await this.deps.dependencyAnalyzer.analyzeDependencies(
            entryFiles,
            rootDir,
          );

          this.updateMetrics({
            dependencyAnalysisTime: Date.now() - startTime,
          });

          return result;
        },
      );

      // Gather relevant files
      const relevantFiles = await this.executePhase(
        "file-processing",
        async () => {
          const files = await this.deps.dependencyAnalyzer.gatherDependencies(
            dependencyAnalysis.dependencies,
            entryFiles,
            options.maxDepth,
          );

          return files.map(file => ({
            absolute: file,
            relative: this.deps.fileSystem.getRelativePath(rootDir, file),
            path: this.deps.fileSystem.getRelativePath(rootDir, file),
          }));
        },
      );

      // Process required files
      const processedFiles = await this.processRequiredFiles(
        relevantFiles,
        rootDir,
      );

      // Read file contents
      const filesWithContent = await this.loadFileContents(processedFiles);

      // Generate token summary
      const stats = await this.executePhase("tokenization", async () => {
        const startTime = Date.now();
        const result =
          await this.deps.tokenCounter.generateSummary(filesWithContent);

        this.updateMetrics({
          tokenizationTime: Date.now() - startTime,
          totalTokens: result.totalTokens,
          filesProcessed: filesWithContent.length,
        });

        return result;
      });

      // Generate output
      const output = await this.executePhase("output-generation", async () => {
        const startTime = Date.now();
        const result = await this.generateOutput(
          filesWithContent,
          this.deps.configManager,
        );

        this.updateMetrics({
          outputGenerationTime: Date.now() - startTime,
        });

        return result;
      });

      // Ensure output directory exists
      await this.deps.fileSystem.createDirectory(
        path.dirname(options.outputFile),
        true,
      );

      // Write output file
      await this.deps.fileSystem.writeFile(options.outputFile, output);

      // Make sure to update stats and dependencies during compilation
      this.stats.startTime = new Date().toISOString();
      // ... update other stats as compilation progresses ...
      this.stats.endTime = new Date().toISOString();
      this.stats.duration = Date.now() - this.startTime;

      const result: ICompileResult = {
        filesProcessed: this.stats.processedFiles,
        outputPath: options.outputFile,
        totalTokens: this.stats.totalTokens,
        generationTime: this.stats.endTime,
        metadata: {
          createdAt: this.stats.startTime,
          updatedAt: this.stats.endTime,
          version: "1.0.0",
        },
      };

      this.logDebug("Compilation completed successfully");
      if (this.debug) {
        this.logDebug(`Metrics: ${JSON.stringify(this.getMetrics(), null, 2)}`);
      }

      return result;
    } catch (error) {
      this.handleError("compile", error);
    }
  }

  private async processRequiredFiles(
    relativeFiles: IFileInfo[],
    rootDir: string,
  ): Promise<IFileInfo[]> {
    this.logDebug("Processing required files");

    const config = this.deps.configManager.getConfig();
    const processedFiles = [...relativeFiles];

    if (config.requiredFiles?.length) {
      this.logDebug(
        `Found ${config.requiredFiles.length} required files in config`,
      );

      for (const requiredFile of config.requiredFiles) {
        const absolutePath = this.deps.fileSystem.resolvePath(
          rootDir,
          requiredFile,
        );

        if (!processedFiles.some(f => f.absolute === absolutePath)) {
          if (this.deps.fileSystem.exists(absolutePath)) {
            processedFiles.push({
              absolute: absolutePath,
              relative: this.deps.fileSystem.getRelativePath(
                rootDir,
                absolutePath,
              ),
              path: this.deps.fileSystem.getRelativePath(rootDir, absolutePath),
            });

            this.logDebug(`Added required file: ${requiredFile}`);
          } else {
            this.metrics.warnings++;
            this.deps.logger.warn(`Required file not found: ${requiredFile}`);
          }
        }
      }
    }

    return processedFiles;
  }

  private async loadFileContents(
    files: IFileInfo[],
    options: ICompileFileOptions = {}
  ): Promise<IFileWithContent[]> {
    this.logDebug(`Loading contents for ${files.length} files`);
  
    const result = await Promise.all(
      files.map(async file => {
        try {
          const content = await this.deps.fileSystem.readFile(file.absolute, {
            encoding: options.encoding || 'utf8' // Use encoding option
          });
  
          // Validate content if requested
          if (options.validateContent && (!content || content.trim() === "")) {
            this.deps.logger.warn(`Empty file content for: ${file.path}`);
            return {
              ...file,
              content: " ",
            };
          }
  
          // Check file size limit
          if (options.maxSize && Buffer.byteLength(content) > options.maxSize) {
            throw new ValidationError(`File exceeds size limit: ${file.path}`);
          }
  
          return {
            ...file,
            content,
          };
        } catch (error) {
          this.metrics.errors++;
          throw new ValidationError(
            `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
            { filePath: file.absolute },
          );
        }
      }),
    );
  
    // Use stats for caching and metrics
    this.stats.processedFiles += result.length;
    
    this.logDebug(`Loaded contents for ${result.length} files`);
    return result;
  }

  public getMetrics(): ICompileMetrics {
    return {
      ...this.metrics,
      processingTime: Date.now() - this.startTime,
      memoryUsage: process.memoryUsage().heapUsed,
    };
  }

  private async generateOutput(
    filesWithContent: IFileWithContent[],
    configManager: IConfigManager,
  ): Promise<string> {
    const generationTime = new Date().toISOString();
    const config = configManager.getConfig();
    const output: string[] = [];

    try {
      // Add main header
      output.push(
        this.deps.templateManager.render("mainHeader", {
          tool: "gather-ts",
          date: generationTime,
        }),
      );

      // Add file summary
      let customNotes = "";
      if (config.customText?.beforeSummary) {
        customNotes =
          "\n## Important Notes\n" + config.customText.beforeSummary;
      }

      output.push(
        this.deps.templateManager.render("fileSummary", {
          tool: "gather-ts",
          customNotes,
        }),
      );

      // Add repository structure
      const fileList = filesWithContent.map(file => file.path).join("\n");

      output.push(
        this.deps.templateManager.render("repositoryStructure", {
          fileList,
        }),
      );

      // Add repository files header
      output.push(this.deps.templateManager.render("repositoryFiles", {}));

      // Add each file
      let processed = 0;
      const total = filesWithContent.length;

      for (const file of filesWithContent) {
        output.push(
          this.deps.templateManager.render("fileEntry", {
            filePath: file.path,
            fileContent: file.content,
          }),
        );

        processed++;
        this.emit("progress", {
          phase: "output-generation",
          completed: processed,
          total,
          message: `Processing ${file.path}`,
        });
      }

      // Add footer if configured
      if (config.customText?.footer) {
        output.push("\n" + config.customText.footer);
      }

      const result = output.join("\n");

      // Validate output contains all expected sections
      this.validateOutput(result);

      return result;
    } catch (error) {
      this.deps.logger.error(
        `Failed to generate output: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Output generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private validateOutput(output: string): void {
    const requiredSections = [
      "File Summary",
      "Repository Structure",
      "Repository Files",
    ];

    for (const section of requiredSections) {
      if (!output.includes(section)) {
        throw new Error(
          `Generated output missing required section: ${section}`,
        );
      }
    }

    // Validate basic structure
    if (!output.includes("================")) {
      throw new Error("Generated output missing file separators");
    }

    this.logDebug("Output validation complete");
  }

  private generateMetricsReport(): string {
    const metrics = this.getMetrics();
    return [
      "================================================================",
      "Performance Metrics",
      "================================================================",
      "",
      `Processing Time: ${metrics.processingTime}ms`,
      `Dependency Analysis: ${metrics.dependencyAnalysisTime}ms`,
      `Tokenization: ${metrics.tokenizationTime}ms`,
      `Output Generation: ${metrics.outputGenerationTime}ms`,
      `Memory Usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
      `Files Processed: ${metrics.filesProcessed}`,
      `Total Tokens: ${metrics.totalTokens}`,
      `Errors: ${metrics.errors}`,
      `Warnings: ${metrics.warnings}`,
      "",
    ].join("\n");
  }
}
