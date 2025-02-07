// src/utils/filesystem/interfaces/IFileSystem.ts

import { IService } from "@/types/services";
import { ILogger } from "@/utils/logging/interfaces/ILogger";

export interface IFileOperationOptions {
  encoding?: BufferEncoding;
  flag?: string;
}

export interface IFileSystemOptions {
  debug?: boolean;
}

export interface IFileSystemDeps {
  logger: ILogger;
}

export interface IFileSystem extends IService {
  // Path operations
  resolvePath(...paths: string[]): string;
  joinPath(...paths: string[]): string;
  getRelativePath(from: string, to: string): string;
  getDirName(path: string): string;
  getBaseName(path: string): string;
  getExtension(path: string): string;
  isAbsolute(path: string): boolean;

  // Alternative path operation names
  dirname(path: string): string;
  basename(path: string): string;
  extname(path: string): string;

  // Synchronous operations
  statSync(path: string): {
    mtime: Date;
  };
  readFileSync(filePath: string, encoding?: BufferEncoding): string;
  writeFileSync(
    filePath: string,
    data: string | Buffer,
    options?: IFileOperationOptions,
  ): void;
  exists(path: string): boolean;
  isReadable(filePath: string): boolean;
  isWritable(filePath: string): boolean;

  // Asynchronous operations
  readFile(filePath: string, options?: IFileOperationOptions): Promise<string>;
  writeFile(
    filePath: string,
    data: string | Buffer,
    options?: IFileOperationOptions,
  ): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  createDirectory(dirPath: string, recursive?: boolean): Promise<void>;

  // Validation
  validatePath(filePath: string, checkExists?: boolean): void;
}
