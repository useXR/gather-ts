#!/usr/bin/env node
import "module-alias/register"; // Add this at the top
import { Command } from "commander";
import path from "path";
import { DefaultCompileContext } from "./core/compiler/CompileContext";
import { ConfigManager } from "./config/ConfigManager";
import { IgnoreHandler } from "./core/dependency/IgnoreHandler";
import { TokenCounter } from "./core/tokenization/TokenCounter";
import { ErrorHandler } from "./errors/handlers/ErrorHandler";
import { logger } from "./utils/logging";
import { fileSystem } from "./utils/filesystem/FileSystem";
import { FileSystemError, ValidationError } from "./errors";

async function generateDefaultConfig(projectRoot: string) {
  logger.info(
    "No deppack.config.json found. Creating one with default settings..."
  );

  try {
    ConfigManager.generateDefaultConfig(
      path.join(projectRoot, "deppack.config.json")
    );
    logger.success("Created default configuration file: deppack.config.json");
  } catch (error) {
    logger.warn(
      "Could not create default config file. Using default settings."
    );
  }
}

function parseEntryFiles(inputs: string[]): string[] {
  // Handle both space-separated and comma-separated inputs
  return inputs
    .flatMap((input) => input.split(","))
    .map((file) => file.trim())
    .filter((file) => file.length > 0);
}

async function validateEntryFiles(
  files: string[],
  projectRoot: string
): Promise<string[]> {
  const validFiles: string[] = [];
  const notFound: string[] = [];

  for (const file of files) {
    const filePath = path.resolve(projectRoot, file);
    if (fileSystem.exists(filePath)) {
      validFiles.push(filePath);
    } else {
      notFound.push(file);
    }
  }

  if (notFound.length > 0) {
    logger.error("Some entry files were not found:");
    notFound.forEach((file) => logger.error(`  - ${file}`));
    process.exit(1);
  }

  return validFiles;
}

function validateRoot(root: string): string {
  const absolutePath = path.resolve(root);
  if (!fileSystem.exists(absolutePath)) {
    logger.error(`Root directory does not exist: ${root}`);
    process.exit(1);
  }
  return absolutePath;
}

async function main() {
    const program = new Command();
  
    program
      .name('deppack')
      .description('Analyze and package code for AI analysis')
      .argument('<files...>', 'Entry files to analyze (comma or space separated)')
      .requiredOption('-o, --output <file>', 'Output file path')
      .option('-r, --root <path>', 'Project root directory', process.cwd())
      .option('-d, --depth <number>', 'Maximum depth for dependency analysis')
      .option('--init', 'Initialize deppack configuration in current directory')
      .version('1.0.0')
      .addHelpText('after', `
  Examples:
    # Single file
    $ deppack src/app/page.tsx -o output.txt
  
    # Multiple files (space-separated)
    $ deppack src/app/page.tsx src/components/Button.tsx -o output.txt
  
    # Multiple files (comma-separated)
    $ deppack src/app/page.tsx,src/components/Button.tsx -o output.txt
  
    # With specific root directory
    $ deppack src/app/page.tsx src/utils.ts -o output.txt -r /path/to/project
  
    # With depth limit
    $ deppack src/app/page.tsx -o output.txt -d 3
  
    # Initialize configuration in specified directory
    $ deppack --init -r /path/to/project
      `);
  
    program.parse();
  
    const options = program.opts();
    const projectRoot = validateRoot(options.root);
  
    // Handle --init flag
    if (options.init) {
      await generateDefaultConfig(projectRoot);
      return;
    }
  
    // Parse and validate entry files
    const entryFiles = parseEntryFiles(program.args);
    if (entryFiles.length === 0) {
      logger.error('No entry files specified');
      logger.info('For help, run: deppack --help');
      process.exit(1);
    }
  
    // Convert entry files to absolute paths
    const absoluteEntryPaths = entryFiles.map(file => path.resolve(projectRoot, file));
  
    try {
      // Check if config exists, if not, generate default
      const configPath = path.join(projectRoot, 'deppack.config.json');
      if (!fileSystem.exists(configPath)) {
        await generateDefaultConfig(projectRoot);
      }
  
      logger.info('\nAnalyzing dependencies for:');
      absoluteEntryPaths.forEach(file => {
        logger.info(`  - ${path.relative(projectRoot, file)}`);
      });
      logger.info(`Using project root: ${projectRoot}`);
      
      const configHandler = new ConfigManager(projectRoot);
      const ignoreHandler = new IgnoreHandler(projectRoot);
      const tokenCounter = new TokenCounter(configHandler);
      const errorHandler = new ErrorHandler();
      
      const compiler = new DefaultCompileContext(
        configHandler,
        ignoreHandler,
        tokenCounter,
        errorHandler
      );
  
      const result = await compiler.compile({
        entryFiles: absoluteEntryPaths,
        outputFile: path.resolve(projectRoot, options.output),
        rootDir: projectRoot,
        maxDepth: options.depth ? parseInt(options.depth) : undefined
      });
  
      logger.success(`\nAnalysis complete!`);
      logger.info(`Entry files analyzed: ${entryFiles.length}`);
      logger.info(`Total files processed: ${result.filesProcessed}`);
      logger.info(`Total tokens analyzed: ${result.totalTokens.toLocaleString()}`);
      logger.info(`Output written to: ${path.relative(projectRoot, result.outputPath)}`);
      
      // Show hint about token limits if approaching them
      const warning = configHandler.getTokenWarning(result.totalTokens);
      if (warning) {
        logger.warn('\n' + warning);
      }
  
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      if (error instanceof Error) {
        logger.error(`Error in ${projectRoot}:`);
        logger.error(error.message);
      }
      logger.info('\nFor help, run: deppack --help');
      process.exit(1);
    }
  }
  
  main();