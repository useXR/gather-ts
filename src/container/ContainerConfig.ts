// src/container/ContainerConfig.ts

import { Container, ServiceTokens } from "./Container";
import { ConfigManager } from "../config/ConfigManager";
import { IgnoreHandler } from "../core/dependency/IgnoreHandler";
import { TokenCounter } from "../core/tokenization/TokenCounter";
import { TokenCache } from "../core/tokenization/TokenCache";
import { ErrorHandler } from "../errors/handlers/ErrorHandler";
import { ErrorUtils } from "../errors/utils/ErrorUtils";
import { FileSystem } from "../utils/filesystem/FileSystem";
import { DependencyAnalyzer } from "../core/dependency/DependencyAnalyzer";
import { Logger } from "../utils/logging/Logger";
import { Validator } from "../utils/validation/Validator";
import { DefaultCompileContext } from "../core/compiler/CompileContext";
import { ArgumentParser } from "../core/compiler/ArgumentParser";
import { IContainerOptions, IContainer } from "./interfaces/IContainer";
import { ILogger } from "@/utils/logging/interfaces/ILogger";
import { IFileSystem } from "@/utils/filesystem/interfaces/IFileSystem";
import { IErrorUtils } from "@/errors/interfaces/IErrorUtils";
import { IConfigManager } from "@/config/interfaces/IConfigManager";
import { ITokenCache } from "@/core/tokenization/interfaces/ITokenCache";
import { IIgnoreHandler } from "@/core/dependency/interfaces/IIgnoreHandler";
import { IValidator } from "@/utils/validation/interfaces/IValidator";

// Helper function to handle container resolution with error checking
function resolveService<T>(
  container: IContainer,
  token: string,
  name: string
): T {
  const service = container.resolve<T>(token);
  if (!service) {
    throw new Error(`Failed to resolve ${name} service`);
  }
  return service;
}

export async function configureContainer(projectRoot: string, options: IContainerOptions = {}): Promise<IContainer> {
  const container = Container.getInstance(options.debug);

  try {
    // Initialize the container first
    await container.initialize();

    // First, register the logger as it's needed by most other services
    container.registerFactory(ServiceTokens.LOGGER, () => {
      return new Logger(
        {
          outputStream: process.stdout,
          errorStream: process.stderr
        },
        {
          enableDebug: options.debug,
          timestamp: options.debug,
          logLevel: options.debug ? 'debug' : 'info'
        }
      );
    });

    // Get logger instance and initialize it
    const logger = resolveService<ILogger>(container, ServiceTokens.LOGGER, 'Logger');
    await logger.initialize();
    logger.debug('Configuring container services...');

    // Register FileSystem with logger dependency
    container.registerFactory(ServiceTokens.FILE_SYSTEM, () => {
      return new FileSystem({ logger }, { debug: options.debug });
    });

    // Get FileSystem instance for other services
    const fileSystem = resolveService<IFileSystem>(container, ServiceTokens.FILE_SYSTEM, 'FileSystem');

    // Register Validator
    container.registerFactory(ServiceTokens.VALIDATOR, () => {
      return new Validator({ logger }, { debug: options.debug });
    });

    // Register ErrorUtils
    container.registerFactory(ServiceTokens.ERROR_UTILS, () => {
      return new ErrorUtils({ logger }, { debug: options.debug });
    });

    // Register ErrorHandler
    container.registerFactory(ServiceTokens.ERROR_HANDLER, () => {
      const errorUtils = resolveService<IErrorUtils>(container, ServiceTokens.ERROR_UTILS, 'ErrorUtils');
      return new ErrorHandler(
        { 
          fileSystem,
          logger,
          errorUtils
        },
        {
          logToConsole: true,
          logToFile: options.debug,
          logFilePath: options.debug ? fileSystem.joinPath(projectRoot, '.deppack', 'error.log') : undefined,
          debug: options.debug
        }
      );
    });

    // Register ConfigManager
    container.registerFactory(ServiceTokens.CONFIG_MANAGER, () => {
      const validator = resolveService<IValidator>(container, ServiceTokens.VALIDATOR, 'Validator');
      return new ConfigManager(
        projectRoot,
        { 
          fileSystem,
          logger,
          validator
        },
        { debug: options.debug }
      );
    });

    // Register TokenCache
    container.registerFactory(ServiceTokens.TOKEN_CACHE, () => {
      return new TokenCache(
        projectRoot,
        {
          fileSystem,
          logger
        },
        {
          debug: options.debug,
          maxCacheAge: options.maxCacheAge
        }
      );
    });

    // Register IgnoreHandler
    container.registerFactory(ServiceTokens.IGNORE_HANDLER, () => {
      return new IgnoreHandler(
        projectRoot,
        {
          fileSystem,
          logger
        },
        { debug: options.debug }
      );
    });

    // Register TokenCounter
    container.registerFactory(ServiceTokens.TOKEN_COUNTER, () => {
      const configManager = resolveService<IConfigManager>(container, ServiceTokens.CONFIG_MANAGER, 'ConfigManager');
      const tokenCache = resolveService<ITokenCache>(container, ServiceTokens.TOKEN_CACHE, 'TokenCache');
      
      return new TokenCounter(
        {
          configManager,
          fileSystem,
          logger,
          cache: tokenCache
        },
        {
          debug: options.debug,
          batchSize: options.batchSize
        }
      );
    });

    // Register DependencyAnalyzer
    container.registerFactory(ServiceTokens.DEPENDENCY_ANALYZER, () => {
      const ignoreHandler = resolveService<IIgnoreHandler>(container, ServiceTokens.IGNORE_HANDLER, 'IgnoreHandler');
      
      return new DependencyAnalyzer(
        {
          fileSystem,
          logger,
          ignoreHandler
        },
        {
          debug: options.debug,
          fileExtensions: options.fileExtensions,
          tsConfigPath: options.customTsConfigPath
        }
      );
    });

    // Register ArgumentParser
    container.registerFactory(ServiceTokens.ARGUMENT_PARSER, () => {
      const validator = resolveService<IValidator>(container, ServiceTokens.VALIDATOR, 'Validator');
      return new ArgumentParser(
        {
          logger,
          fileSystem,
          validator
        },
        { debug: options.debug }
      );
    });

    // Register Compiler
    container.registerFactory(ServiceTokens.COMPILER, () => {
      return new DefaultCompileContext(
        {
          configManager: resolveService<IConfigManager>(container, ServiceTokens.CONFIG_MANAGER, 'ConfigManager'),
          ignoreHandler: resolveService<IIgnoreHandler>(container, ServiceTokens.IGNORE_HANDLER, 'IgnoreHandler'),
          tokenCounter: resolveService(container, ServiceTokens.TOKEN_COUNTER, 'TokenCounter'),
          errorHandler: resolveService(container, ServiceTokens.ERROR_HANDLER, 'ErrorHandler'),
          dependencyAnalyzer: resolveService(container, ServiceTokens.DEPENDENCY_ANALYZER, 'DependencyAnalyzer'),
          logger,
          fileSystem
        },
        {
          debug: options.debug,
          batchSize: options.batchSize
        }
      );
    });

    logger.debug('Container configuration complete');
    return container;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to configure container: ${errorMessage}`);
  }
}


export async function initializeContainer(
  container: IContainer
): Promise<void> {
  const logger = resolveService<ILogger>(
    container,
    ServiceTokens.LOGGER,
    "Logger"
  );

  try {
    logger.debug("Starting container initialization");
    await container.initialize();
    logger.debug("Container initialization complete");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to initialize container: ${errorMessage}`);
    throw error;
  }
}

export function cleanupContainer(container: IContainer): void {
  try {
    const logger = resolveService<ILogger>(container, ServiceTokens.LOGGER, 'Logger');
    logger.debug('Starting container cleanup');
    container.cleanup();
    logger.debug('Container cleanup complete');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to cleanup container: ${errorMessage}`);
    throw error;
  }
}