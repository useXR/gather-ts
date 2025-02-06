// src/core/compiler/ArgumentParser.ts

import path from 'path';
import { IArgumentParser, IArgumentParserOptions, IParseOptions } from './interfaces/IArgumentParser';
import { ICompileOptions } from '@/types/compiler';
import { ValidationError } from '@/errors';
import { IArgumentParserDeps } from './interfaces/IArgumentParser';


export class ArgumentParser implements IArgumentParser {
  private readonly debug: boolean;
  private readonly maxDepth: number;
  private readonly defaultBatchSize: number;

  constructor(
    private readonly deps: IArgumentParserDeps,
    options: IArgumentParserOptions = {}
  ) {
    this.debug = options.debug || false;
    this.maxDepth = options.maxDepth || 10;
    this.defaultBatchSize = options.defaultBatchSize || 100;
  }

  public async initialize(): Promise<void> {
    this.logDebug('Initializing ArgumentParser');
  }

  public cleanup(): void {
    this.logDebug('Cleaning up ArgumentParser');
  }

  private logDebug(message: string): void {
    if (this.debug) {
      this.deps.logger.debug(message);
    }
  }

  public parseArguments(args: string[], options: IParseOptions = {}): ICompileOptions {
    this.logDebug(`Parsing arguments: ${args.join(' ')}`);

    try {
      if (!args.length && !options.allowEmpty) {
        throw new ValidationError('No arguments provided');
      }

      // Parse entry files
      const entryFiles = this.parseEntryFiles(args[0]);
      
      // Parse output file
      const outputFile = this.parseOutputFile(args[1], options.requireOutput);

      // Parse optional arguments
      const compileOptions = this.parseOptions(args.slice(2));

      if (options.validatePaths) {
        this.validatePaths(entryFiles, outputFile);
      }

      const result = {
        entryFiles,
        outputFile,
        ...compileOptions
      };

      this.logDebug(`Parsed options: ${JSON.stringify(result)}`);
      return result;

    } catch (error) {
      throw new ValidationError(
        `Failed to parse arguments: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private parseEntryFiles(filesArg: string): string[] {
    this.logDebug(`Parsing entry files: ${filesArg}`);

    this.deps.validator.validateNotEmpty(filesArg, 'Entry files argument');

    const files = filesArg
      .split(',')
      .map(f => f.trim())
      .filter(f => f.length > 0);

    if (files.length === 0) {
      throw new ValidationError('No valid entry files provided');
    }

    // Validate each file exists
    files.forEach(file => {
      this.deps.validator.validatePath(file, 'Entry file');
      if (!this.deps.fileSystem.exists(file)) {
        throw new ValidationError(`Entry file does not exist: ${file}`);
      }
    });

    return files;
  }

  private parseOutputFile(outputArg: string, required: boolean = true): string {
    this.logDebug(`Parsing output file: ${outputArg}`);

    if (required) {
      this.deps.validator.validateNotEmpty(outputArg, 'Output file argument');
    }

    const outputFile = outputArg?.trim();
    if (!outputFile && required) {
      throw new ValidationError('Output file path cannot be empty');
    }

    // Ensure output directory exists or can be created
    if (outputFile) {
      const outputDir = this.deps.fileSystem.getDirName(outputFile);
      if (!this.deps.fileSystem.exists(outputDir)) {
        try {
          this.deps.fileSystem.createDirectory(outputDir, true);
          this.logDebug(`Created output directory: ${outputDir}`);
        } catch (error) {
          throw new ValidationError(
            `Cannot create output directory: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }

    return outputFile;
  }

  private parseOptions(args: string[]): Partial<ICompileOptions> {
    this.logDebug(`Parsing additional options: ${args.join(' ')}`);
    
    const options: Partial<ICompileOptions> = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--root':
        case '-r':
          i++;
          options.rootDir = this.parseRootDir(args[i]);
          break;

        case '--depth':
        case '-d':
          i++;
          options.maxDepth = this.parseDepth(args[i]);
          break;

        case '--batch-size':
          i++;
          const batchSize = this.deps.validator.validateNotEmpty(args[i], 'Batch size');
          const parsedBatchSize = parseInt(batchSize);
          if (isNaN(parsedBatchSize) || parsedBatchSize <= 0) {
            throw new ValidationError('Batch size must be a positive number');
          }
          options.batchSize = parsedBatchSize;
          break;

        case '--config':
        case '-c':
          i++;
          const configPath = this.deps.validator.validateNotEmpty(args[i], 'Config path');
          if (!this.deps.fileSystem.exists(configPath)) {
            throw new ValidationError(`Config file not found: ${configPath}`);
          }
          options.config = { path: configPath } as Record<string, unknown>;
          break;

        case '--encoding':
          i++;
          const encoding = this.deps.validator.validateNotEmpty(args[i], 'Encoding');
          if (!this.isValidEncoding(encoding)) {
            throw new ValidationError(`Invalid encoding: ${encoding}`);
          }
          options.encoding = encoding as BufferEncoding;
          break;

        case '--ignore':
          i++;
          options.ignorePatterns = this.parseIgnorePatterns(args.slice(i));
          i += (options.ignorePatterns?.length || 0) - 1;
          break;

        case '--require':
          i++;
          options.requiredFiles = this.parseRequiredFiles(args.slice(i));
          i += (options.requiredFiles?.length || 0) - 1;
          break;

        case '--init':
          options.init = true;
          break;

        case '--metrics':
          options.includeMetrics = true;
          break;

        case '--debug':
          options.debug = true;
          break;

        default:
          if (arg.startsWith('-')) {
            throw new ValidationError(`Unknown option: ${arg}`);
          }
      }
    }

    return options;
  }

  private parseRootDir(rootDir?: string): string {
    this.logDebug(`Parsing root directory: ${rootDir}`);

    this.deps.validator.validateNotEmpty(rootDir, 'Root directory argument');

    const absolutePath = path.resolve(rootDir!);
    if (!this.deps.fileSystem.exists(absolutePath)) {
      throw new ValidationError('Root directory does not exist', { rootDir: absolutePath });
    }

    return absolutePath;
  }

  private parseDepth(depthArg?: string): number {
    this.logDebug(`Parsing depth: ${depthArg}`);

    this.deps.validator.validateNotEmpty(depthArg, 'Depth argument');

    const depth = parseInt(depthArg!);
    if (isNaN(depth)) {
      throw new ValidationError('Depth must be a number');
    }

    if (depth < 0) {
      throw new ValidationError('Depth cannot be negative');
    }

    if (depth > this.maxDepth) {
      throw new ValidationError(`Depth cannot exceed ${this.maxDepth}`);
    }

    return depth;
  }

  private isValidEncoding(encoding: string): encoding is BufferEncoding {
    const validEncodings: BufferEncoding[] = [
      'utf8', 'utf-8', 'utf16le', 'latin1', 'ascii', 'base64', 'hex', 'binary', 'ucs2'
    ];
    return validEncodings.includes(encoding as BufferEncoding);
  }

  private parseIgnorePatterns(args: string[]): string[] {
    this.logDebug(`Parsing ignore patterns: ${args.join(' ')}`);
    
    const patterns: string[] = [];
    for (const arg of args) {
      if (arg.startsWith('-')) break;
      patterns.push(arg);
    }
    return patterns;
  }

  private parseRequiredFiles(args: string[]): string[] {
    this.logDebug(`Parsing required files: ${args.join(' ')}`);
    
    const files: string[] = [];
    for (const arg of args) {
      if (arg.startsWith('-')) break;
      
      this.deps.validator.validatePath(arg, 'Required file');
      if (!this.deps.fileSystem.exists(arg)) {
        this.deps.logger.warn(`Required file not found: ${arg}`);
        continue;
      }
      files.push(arg);
    }
    return files;
  }

  private validatePaths(entryFiles: string[], outputFile: string): void {
    entryFiles.forEach(file => {
      this.deps.validator.validatePath(file, 'Entry file');
    });

    if (outputFile) {
      const outputDir = this.deps.fileSystem.getDirName(outputFile);
      this.deps.validator.validatePath(outputDir, 'Output directory');
    }
  }

  public printUsage(): void {
    const usage = [
      'Usage: deppack <files...> -o <output> [options]',
      '',
      'Arguments:',
      '  files                Entry files to analyze (comma or space separated)',
      '  -o, --output        Output file path',
      '',
      'Options:',
      '  -r, --root          Project root directory (default: current directory)',
      '  -d, --depth         Maximum depth for dependency analysis',
      '  --debug             Enable debug logging',
      '  --batch-size        Batch size for processing files',
      '  --metrics           Include performance metrics in output',
      '  -c, --config        Path to custom config file',
      '  --encoding          File encoding (default: utf8)',
      '  --ignore            Additional patterns to ignore',
      '  --require           Required files to include',
      '  --init              Initialize configuration in current directory',
      '',
      'Examples:',
      '  # Single file with metrics',
      '  $ deppack src/app/page.tsx -o output.txt --metrics',
      '',
      '  # Multiple files with custom batch size',
      '  $ deppack src/app/page.tsx,src/components/Button.tsx -o output.txt --batch-size 50',
      '',
      '  # With custom encoding and ignore patterns',
      '  $ deppack src/app/page.tsx -o output.txt --encoding utf16le --ignore "**/*.test.ts"',
      '',
      '  # With required files and depth limit',
      '  $ deppack src/app/page.tsx -o output.txt -d 3 --require "src/types.ts"'
    ].join('\n');

    this.deps.logger.info(usage);
  }
}