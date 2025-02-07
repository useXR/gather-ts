import { ICompileOptions } from '@/types/compiler';
import { ILogger, IValidator } from '@/utils';
import { IFileSystem } from '@/utils/filesystem/interfaces/IFileSystem';
import { IService } from '@/types/services';

export interface IArgumentParserDeps {
  logger: ILogger;
  fileSystem: IFileSystem;
  validator: IValidator;
}

export interface IArgumentParserOptions {
  debug?: boolean;
  maxDepth?: number;
  defaultBatchSize?: number;
}

export interface IArgumentParser extends IService {
  parseArguments(args: string[], options?: IParseOptions): ICompileOptions;
  printUsage(): void;
}

export interface IParseOptions {
  allowEmpty?: boolean;
  requireOutput?: boolean;
  validatePaths?: boolean;
}