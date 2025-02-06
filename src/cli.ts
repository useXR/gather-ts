// src/cli.ts

import './register';
import { EventEmitter } from "events";
import { ValidationError } from "@/errors";
import {
  ICLI,
  ICLIDeps,
  ICLIOptions,
  ICLIResult,
  ICLIMetrics,
  ICLIEventMap,
} from "./interfaces/cli";
import { configureContainer } from "./container/ContainerConfig";
import { ServiceTokens } from "./container/Container";
import path from 'path';

export class CLI extends EventEmitter implements ICLI {
  private readonly debug: boolean;
  private readonly exitOnError: boolean;
  private isInitialized: boolean = false;
  private metrics: ICLIMetrics = {
    executionTime: 0,
    memoryUsage: 0,
    filesProcessed: 0,
    errors: 0,
    warnings: 0,
  };
  private startTime: number = Date.now();

  constructor(private readonly deps: ICLIDeps, options: ICLIOptions = {}) {
    super();
    this.debug = options.debug || false;
    this.exitOnError = options.exitOnError ?? true;
  }

  private logDebug(message: string): void {
    if (this.debug) {
      this.deps.logger.debug(`[CLI] ${message}`);
    }
  }

  public async initialize(): Promise<void> {
    this.logDebug("Initializing CLI");

    try {
      if (this.isInitialized) {
        this.logDebug("CLI already initialized");
        return;
      }

      this.startTime = Date.now();
      this.initializeMetrics();
      this.setupEventListeners();

      this.isInitialized = true;
      this.logDebug("CLI initialization complete");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.deps.logger.error(`Failed to initialize CLI: ${err.message}`);
      throw err;
    }
  }

  public cleanup(): void {
    this.logDebug('Cleaning up CLI');
    this.removeAllListeners();
    this.isInitialized = false;
  }

  private initializeMetrics(): void {
    this.metrics = {
      executionTime: 0,
      memoryUsage: 0,
      filesProcessed: 0,
      errors: 0,
      warnings: 0,
    };
  }

  private setupEventListeners(): void {
    this.logDebug("Setting up event listeners");

    this.on("command:start", ({ command, options }) => {
      if (this.debug) {
        this.deps.logger.debug(`Starting command: ${command}`);
        this.deps.logger.debug(`Options: ${JSON.stringify(options, null, 2)}`);
      }
    });

    this.on("command:complete", ({ result }) => {
      this.metrics.executionTime = Date.now() - this.startTime;
      this.metrics.memoryUsage = process.memoryUsage().heapUsed;

      if (result.metrics) {
        Object.assign(this.metrics, result.metrics);
      }
    });

    this.on("error", ({ error, command }) => {
      this.metrics.errors++;
      if (command) {
        this.deps.logger.error(`Error in command ${command}:`);
      }
      this.deps.logger.error(error.message);
      if (error.stack && this.debug) {
        this.deps.logger.debug(error.stack);
      }
    });

    this.on("warning", ({ message }) => {
      this.metrics.warnings++;
      this.deps.logger.warn(message);
    });

    this.on("progress", ({ phase, completed, total, message }) => {
      const percentage = Math.round((completed / total) * 100);
      this.deps.logger.info(
        `${phase}: ${percentage}% (${completed}/${total}) ${message || ""}`
      );
    });
  }

  private async generateDefaultConfig(
    projectRoot: string
  ): Promise<ICLIResult> {
    this.logDebug("Generating default configuration");

    try {
      this.deps.logger.info(
        "No deppack.config.json found. Creating one with default settings..."
      );

      await this.deps.configManager.initialize();

      this.deps.logger.success(
        "Created default configuration file: deppack.config.json"
      );

      return {
        success: true,
        exitCode: 0,
        output: "Configuration initialized successfully",
      };
    } catch (error) {
      this.deps.logger.warn(
        "Could not create default config file. Using default settings."
      );
      return {
        success: false,
        exitCode: 1,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  private validateRoot(root: string): string {
    if (!this.isInitialized) {
      throw new ValidationError("CLI not initialized");
    }

    this.logDebug(`Validating root directory: ${root}`);

    const absolutePath = path.resolve(root);
    if (!this.deps.fileSystem.exists(absolutePath)) {
      throw new ValidationError("Invalid root directory", {
        root: absolutePath,
      });
    }
    return absolutePath;
  }

  public async run(): Promise<ICLIResult> {
    if (!this.isInitialized) {
      throw new ValidationError("CLI not initialized");
    }

    this.logDebug("Starting CLI execution");

    try {
      // Parse command line arguments
      const compileOptions = this.deps.argumentParser.parseArguments(
        process.argv.slice(2)
      );

      const projectRoot = this.validateRoot(
        compileOptions.rootDir || process.cwd()
      );

      this.emit("command:start", {
        command: "compile",
        options: compileOptions,
        timestamp: Date.now(),
      });

      // Handle --init flag
      if (compileOptions.init) {
        return await this.generateDefaultConfig(projectRoot);
      }

      // Process required files if specified
      if (compileOptions.requiredFiles?.length) {
        this.deps.logger.info("Processing required files...");
        for (const file of compileOptions.requiredFiles) {
          const absolutePath = path.resolve(projectRoot, file);
          if (!this.deps.fileSystem.exists(absolutePath)) {
            this.emit("warning", {
              message: `Required file not found: ${file}`,
              command: "compile",
              timestamp: Date.now(),
            });
          }
        }
      }

      // Forward progress events from compiler
      this.deps.compiler.on("progress", (progress) => {
        this.emit("progress", progress);
      });

      // Run compilation
      const result = await this.deps.compiler.compile({
        ...compileOptions,
        rootDir: projectRoot,
      });

      // Log results
      this.deps.logger.success(`\nAnalysis complete!`);
      this.deps.logger.info(`Files processed: ${result.filesProcessed}`);
      this.deps.logger.info(
        `Tokens analyzed: ${result.totalTokens.toLocaleString()}`
      );
      this.deps.logger.info(
        `Output: ${path.relative(projectRoot, result.outputPath)}`
      );

      // Show metrics if enabled
      if (compileOptions.includeMetrics) {
        const metrics = this.deps.compiler.getMetrics();
        this.deps.logger.info("\nPerformance Metrics:");
        this.deps.logger.info("------------------");
        this.deps.logger.info(`Processing Time: ${metrics.processingTime}ms`);
        this.deps.logger.info(
          `Memory Usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`
        );
        this.deps.logger.info(`Files: ${metrics.filesProcessed}`);
        this.deps.logger.info(`Errors: ${metrics.errors}`);
        this.deps.logger.info(`Warnings: ${metrics.warnings}`);
      }

      // Check for warnings
      const warning = this.deps.configManager.getTokenWarning(
        result.totalTokens
      );
      if (warning) {
        this.emit("warning", {
          message: warning,
          command: "compile",
          timestamp: Date.now(),
        });
      }

      const cliResult: ICLIResult = {
        success: true,
        exitCode: 0,
        output: result.outputPath,
        metrics: this.metrics,
      };

      this.emit("command:complete", {
        command: "compile",
        result: cliResult,
        timestamp: Date.now(),
      });

      return cliResult;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      this.emit("error", {
        error: err,
        command: "compile",
        timestamp: Date.now(),
      });

      if (err instanceof ValidationError) {
        this.deps.argumentParser.printUsage();
      }

      if (this.exitOnError) {
        process.exit(1);
      }

      return {
        success: false,
        exitCode: 1,
        error: err,
        metrics: this.metrics,
      };
    }
  }  
}

// Main entry point
// Main entry point
async function main() {
  let cli: CLI | undefined;
  let container;

  try {
    container = await configureContainer(process.cwd(), {
      debug: process.argv.includes('--debug'),
      maxCacheAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      fileExtensions: ['ts', 'tsx', 'js', 'jsx']
    });

    if (!container) {
      throw new Error('Failed to configure container');
    }

    cli = new CLI({
      logger: container.resolve(ServiceTokens.LOGGER),
      configManager: container.resolve(ServiceTokens.CONFIG_MANAGER),
      compiler: container.resolve(ServiceTokens.COMPILER),
      argumentParser: container.resolve(ServiceTokens.ARGUMENT_PARSER),
      fileSystem: container.resolve(ServiceTokens.FILE_SYSTEM)
    }, {
      debug: process.argv.includes('--debug'),
      exitOnError: true
    });

    await cli.initialize();
    const result = await cli.run();
    
    if (!result.success) {
      process.exit(result.exitCode);
    }
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  } finally {
    if (cli) {
      cli.cleanup();
    }
    if (container) {
      container.cleanup();
    }
  }
}

// Make sure main is called correctly
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}