// src/errors/handlers/ErrorHandler.ts

import { BaseService } from "@/types/services";
import { GatherTSError } from "../exceptions";
import {
  IErrorHandler,
  IErrorProcessingStrategy,
  IErrorHandlerDeps,
  IErrorHandlerOptions,
  IErrorOperationOptions,
} from "../interfaces/IErrorHandler";

export class ErrorHandler extends BaseService implements IErrorHandler {
  private readonly processingStrategies: IErrorProcessingStrategy[] = [];
  private readonly debug: boolean;
  private readonly logToConsole: boolean;
  private readonly logToFile: boolean;
  private readonly logFilePath?: string;
  private readonly rethrow: boolean;

  constructor(
    private readonly deps: IErrorHandlerDeps,
    options: IErrorHandlerOptions = {},
  ) {
    super();
    this.debug = options.debug || false;
    this.logToConsole = options.logToConsole ?? true;
    this.logToFile = options.logToFile || false;
    this.logFilePath = options.logFilePath;
    this.rethrow = options.rethrow || false;

    if (this.logToConsole) {
      this.registerStrategy(this.createConsoleStrategy());
    }
  }

  public override async initialize(): Promise<void> {
    await super.initialize();
    this.logDebug("Initializing ErrorHandler");

    try {
      if (this.logToFile && this.logFilePath) {
        this.logDebug(`Setting up file logging at ${this.logFilePath}`);
        const logDir = this.deps.fileSystem.getDirName(this.logFilePath);

        if (!this.deps.fileSystem.exists(logDir)) {
          await this.deps.fileSystem.createDirectory(logDir, true);
        }

        this.registerStrategy(this.createFileStrategy());
      }

      this.logDebug("ErrorHandler initialization complete");
    } catch (error) {
      this.deps.logger.error(
        `Failed to initialize ErrorHandler: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  public override cleanup(): void {
    this.logDebug("Cleaning up ErrorHandler");
    this.processingStrategies.length = 0;
    super.cleanup();
  }

  private logDebug(message: string): void {
    if (this.debug) {
      this.deps.logger.debug(message);
    }
  }

  public registerStrategy(strategy: IErrorProcessingStrategy): void {
    this.logDebug("Registering new error processing strategy");
    this.processingStrategies.push(strategy);
  }

  public handle(error: Error, options: IErrorOperationOptions = {}): void {
    this.logDebug(`Handling error: ${error.message}`);

    const normalizedError = this.deps.errorUtils.normalizeError(error);
    const context = this.deps.errorUtils.extractErrorContext(normalizedError);

    let processedByStrategy = false;
    for (const strategy of this.processingStrategies) {
      if (strategy.shouldHandle(normalizedError)) {
        processedByStrategy = true;
        this.logDebug("Processing error through strategy");
        strategy.handle(normalizedError, context);
      }
    }

    if (!processedByStrategy) {
      this.logDebug(
        "No strategy handled the error, using default console logging",
      );
      this.deps.logger.error(normalizedError.message);
    }

    if (options.rethrow || this.rethrow) {
      this.logDebug("Rethrowing error as configured");
      throw normalizedError;
    }
  }

  public handleBatch(errors: Error[]): void {
    this.logDebug(`Processing batch of ${errors.length} errors`);

    if (errors.length === 0) {
      return;
    }

    const aggregatedError = this.deps.errorUtils.aggregateErrors(errors);
    this.handle(aggregatedError);
  }

  public async createErrorBoundary(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (error) {
      this.logDebug("Error caught in error boundary");
      this.handle(error instanceof Error ? error : new Error(String(error)));
      return Promise.reject(error);
    }
  }

  private createConsoleStrategy(): IErrorProcessingStrategy {
    return {
      shouldHandle: () => true,
      handle: (error: Error, context: Record<string, unknown>) => {
        const classification = this.deps.errorUtils.classifyError(error);

        switch (classification.severity) {
          case "error":
            this.deps.logger.error(classification.message);
            if (classification.details) {
              if (this.debug) {
                this.deps.logger.debug(
                  `Error details: ${JSON.stringify(classification.details)}`,
                );
              }
            }
            break;
          case "warning":
            this.deps.logger.warn(classification.message);
            break;
          case "info":
            this.deps.logger.info(classification.message);
            break;
        }

        if (this.debug && classification.stackTrace) {
          this.logDebug("Stack trace:" + classification.stackTrace);
        }
      },
    };
  }

  private createFileStrategy(): IErrorProcessingStrategy {
    if (!this.logFilePath) {
      throw new Error("Log file path not configured");
    }

    return {
      shouldHandle: (error: Error) => error instanceof GatherTSError,
      handle: (error: Error, context: Record<string, unknown>) => {
        const timestamp = new Date().toISOString();
        const classification = this.deps.errorUtils.classifyError(error);

        const logEntry = {
          timestamp,
          level: classification.severity,
          type: classification.type,
          message: classification.message,
          details: classification.details,
          context,
        };

        try {
          this.deps.fileSystem.writeFileSync(
            this.logFilePath!,
            JSON.stringify(logEntry) + "\n",
            { flag: "a" },
          );
        } catch (writeError) {
          this.deps.logger.error(
            `Failed to write to error log: ${writeError instanceof Error ? writeError.message : String(writeError)}`,
          );
        }
      },
    };
  }
}
