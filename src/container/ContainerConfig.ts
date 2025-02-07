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
import { ArgumentParser } from "../core/compiler/ArgumentParser";
import { IContainerOptions, IContainer } from "./interfaces/IContainer";
import { ILogger } from "@/utils/logging/interfaces/ILogger";
import { IFileSystem } from "@/utils/filesystem/interfaces/IFileSystem";
import { IErrorUtils } from "@/errors/interfaces/IErrorUtils";
import { IConfigManager } from "@/config/interfaces/IConfigManager";
import { ITokenCache } from "@/core/tokenization/interfaces/ITokenCache";
import { IIgnoreHandler } from "@/core/dependency/interfaces/IIgnoreHandler";
import { IValidator } from "@/utils/validation/interfaces/IValidator";
import { ITokenCounter } from "@/core/tokenization/interfaces/ITokenCounter";
import { IDependencyAnalyzer } from "@/core/dependency/interfaces/IDependencyAnalyzer";
import { IErrorHandler } from "@/errors/interfaces/IErrorHandler";
import { IArgumentParser } from "@/core/compiler/interfaces/IArgumentParser";
import { ICompileContext } from "@/core/compiler/interfaces/ICompileContext";
import { CompileContext } from "@/core/compiler";
import { TemplateManager } from "@/core/templating/TemplateManager";
import { ITemplateManager } from "@/core/templating/interfaces/ITemplateManager";
import { registerDefaultTemplates } from "@/core/templating/DefaultTemplates";

export async function configureContainer(
  projectRoot: string,
  options: IContainerOptions = {},
): Promise<IContainer> {
  const container = Container.getInstance(options.debug);

  try {
    // First, create and initialize the logger
    container.registerFactory(ServiceTokens.LOGGER, () => {
      return new Logger(
        {
          outputStream: process.stdout,
          errorStream: process.stderr,
        },
        {
          enableDebug: options.debug,
          timestamp: options.debug,
          logLevel: options.debug ? "debug" : "info",
        },
      );
    });

    const logger = container.resolve<ILogger>(ServiceTokens.LOGGER);
    await logger.initialize();
    logger.debug("Configuring container services...");

    // Register FileSystem
    container.registerFactory(ServiceTokens.FILE_SYSTEM, () => {
      return new FileSystem({ logger }, { debug: options.debug });
    });

    const fileSystem = container.resolve<IFileSystem>(
      ServiceTokens.FILE_SYSTEM,
    );
    await fileSystem.initialize();

    // Register Validator
    container.registerFactory(ServiceTokens.VALIDATOR, () => {
      return new Validator({ logger }, { debug: options.debug });
    });

    const validator = container.resolve<IValidator>(ServiceTokens.VALIDATOR);
    await validator.initialize();

    // Register ErrorUtils
    container.registerFactory(ServiceTokens.ERROR_UTILS, () => {
      return new ErrorUtils({ logger }, { debug: options.debug });
    });

    const errorUtils = container.resolve<IErrorUtils>(
      ServiceTokens.ERROR_UTILS,
    );
    await errorUtils.initialize();

    // Register ErrorHandler
    container.registerFactory(ServiceTokens.ERROR_HANDLER, () => {
      return new ErrorHandler(
        {
          fileSystem,
          logger,
          errorUtils,
        },
        {
          logToConsole: true,
          logToFile: options.debug,
          logFilePath: options.debug
            ? fileSystem.joinPath(projectRoot, ".gather-ts", "error.log")
            : undefined,
          debug: options.debug,
        },
      );
    });

    const errorHandler = container.resolve<IErrorHandler>(
      ServiceTokens.ERROR_HANDLER,
    );
    await errorHandler.initialize();

    // Register ConfigManager
    container.registerFactory(ServiceTokens.CONFIG_MANAGER, () => {
      return new ConfigManager(
        projectRoot,
        {
          fileSystem,
          logger,
          validator,
        },
        { debug: options.debug },
      );
    });

    const configManager = container.resolve<IConfigManager>(
      ServiceTokens.CONFIG_MANAGER,
    );
    await configManager.initialize();

    // Register TokenCache
    container.registerFactory(ServiceTokens.TOKEN_CACHE, () => {
      return new TokenCache(
        projectRoot,
        {
          fileSystem,
          logger,
        },
        {
          debug: options.debug,
          maxCacheAge: options.maxCacheAge,
        },
      );
    });

    const tokenCache = container.resolve<ITokenCache>(
      ServiceTokens.TOKEN_CACHE,
    );
    await tokenCache.initialize();

    // Register IgnoreHandler
    container.registerFactory(ServiceTokens.IGNORE_HANDLER, () => {
      return new IgnoreHandler(
        projectRoot,
        {
          fileSystem,
          logger,
        },
        { debug: options.debug },
      );
    });

    const ignoreHandler = container.resolve<IIgnoreHandler>(
      ServiceTokens.IGNORE_HANDLER,
    );
    await ignoreHandler.initialize();

    // Register TokenCounter
    container.registerFactory(ServiceTokens.TOKEN_COUNTER, () => {
      return new TokenCounter(
        {
          configManager,
          fileSystem,
          logger,
          cache: tokenCache,
        },
        {
          debug: options.debug,
          batchSize: options.batchSize,
        },
      );
    });

    const tokenCounter = container.resolve<ITokenCounter>(
      ServiceTokens.TOKEN_COUNTER,
    );
    await tokenCounter.initialize();

    // Register DependencyAnalyzer
    container.registerFactory(ServiceTokens.DEPENDENCY_ANALYZER, () => {
      return new DependencyAnalyzer(
        {
          fileSystem,
          logger,
          ignoreHandler,
        },
        {
          debug: options.debug,
          fileExtensions: options.fileExtensions,
          tsConfigPath: options.customTsConfigPath,
        },
      );
    });

    const dependencyAnalyzer = container.resolve<IDependencyAnalyzer>(
      ServiceTokens.DEPENDENCY_ANALYZER,
    );
    await dependencyAnalyzer.initialize();

    // Register ArgumentParser
    container.registerFactory(ServiceTokens.ARGUMENT_PARSER, () => {
      return new ArgumentParser(
        {
          logger,
          fileSystem,
          validator,
        },
        { debug: options.debug },
      );
    });

    const argumentParser = container.resolve<IArgumentParser>(
      ServiceTokens.ARGUMENT_PARSER,
    );
    await argumentParser.initialize();

    container.registerFactory(ServiceTokens.TEMPLATE_MANAGER, () => {
      return new TemplateManager({ logger }, { debug: options.debug });
    });

    const templateManager = container.resolve<ITemplateManager>(
      ServiceTokens.TEMPLATE_MANAGER,
    );
    await templateManager.initialize();

    // Register Compiler
    container.registerFactory(ServiceTokens.COMPILER, () => {
      return new CompileContext(
        {
          configManager,
          ignoreHandler,
          tokenCounter,
          errorHandler,
          dependencyAnalyzer,
          logger,
          fileSystem,
          templateManager,
        },
        {
          debug: options.debug,
          batchSize: options.batchSize,
        },
      );
    });

    const compiler = container.resolve<ICompileContext>(ServiceTokens.COMPILER);
    await compiler.initialize();

    // Register default templates
    registerDefaultTemplates(templateManager);

    logger.debug("Container configuration complete");
    return container;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to configure container: ${errorMessage}`);
  }
}

export async function initializeContainer(
  container: IContainer,
): Promise<void> {
  const logger = container.resolve<ILogger>(ServiceTokens.LOGGER);

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
    const logger = container.resolve<ILogger>(ServiceTokens.LOGGER);
    logger.debug("Starting container cleanup");
    container.cleanup();
    logger.debug("Container cleanup complete");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to cleanup container: ${errorMessage}`);
    throw error;
  }
}
