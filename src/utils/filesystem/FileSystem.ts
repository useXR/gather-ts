// src/utils/filesystem/FileSystem.ts

import fs from "fs";
import path from "path";
import { FileSystemError, ValidationError } from "@/errors";
import {
  IFileSystem,
  IFileSystemOptions,
  IFileSystemDeps,
  IFileOperationOptions,
} from "./interfaces/IFileSystem";
import { BaseService } from "@/types/services";

export class FileSystem extends BaseService implements IFileSystem {
  private readonly debug: boolean;

  constructor(
    private readonly deps: IFileSystemDeps,
    options: IFileSystemOptions = {},
  ) {
    super();
    this.debug = options.debug || false;
  }

  public override async initialize(): Promise<void> {
    await super.initialize();
    this.logDebug("FileSystem service initialized");
  }

  public override cleanup(): void {
    this.logDebug("FileSystem service cleanup");
    super.cleanup();
  }

  private logDebug(message: string): void {
    if (this.debug) {
      this.deps.logger.debug(message);
    }
  }

  private handleError(
    error: unknown,
    operation: string,
    filePath: string,
  ): never {
    const message = error instanceof Error ? error.message : String(error);
    const fsError = new FileSystemError(
      `Failed to ${operation} file: ${message}`,
      filePath,
      operation as "read" | "write" | "delete" | "create",
    );
    this.deps.logger.error(fsError.message);
    throw fsError;
  }

  public statSync(path: string): { mtime: Date } {
    try {
      const stats = fs.statSync(path);
      return {
        mtime: stats.mtime,
      };
    } catch (error) {
      this.handleError(error, "stat", path);
    }
  }

  public readFileSync(
    filePath: string,
    encoding: BufferEncoding = "utf8",
  ): string {
    this.checkInitialized();
    this.logDebug(`Reading file synchronously: ${filePath}`);
    try {
      return fs.readFileSync(filePath, encoding);
    } catch (error) {
      this.handleError(error, "read", filePath);
    }
  }

  public writeFileSync(
    filePath: string,
    data: string | Buffer,
    options?: IFileOperationOptions,
  ): void {
    this.logDebug(`Writing file synchronously: ${filePath}`);
    try {
      const dir = this.getDirName(filePath);
      if (!this.exists(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, data, options);
    } catch (error) {
      this.handleError(error, "write", filePath);
    }
  }

  public exists(path: string): boolean {
    return fs.existsSync(path);
  }

  public isReadable(filePath: string): boolean {
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  public isWritable(filePath: string): boolean {
    try {
      fs.accessSync(filePath, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  public async readFile(
    filePath: string,
    options?: IFileOperationOptions,
  ): Promise<string> {
    this.logDebug(`Reading file: ${filePath}`);
    try {
      const buffer = await fs.promises.readFile(filePath, options);
      return buffer.toString(options?.encoding || "utf8");
    } catch (error) {
      this.handleError(error, "read", filePath);
    }
  }

  public async writeFile(
    filePath: string,
    data: string | Buffer,
    options?: IFileOperationOptions,
  ): Promise<void> {
    this.logDebug(`Writing file: ${filePath}`);
    try {
      const dir = this.getDirName(filePath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(filePath, data, options);
    } catch (error) {
      this.handleError(error, "write", filePath);
    }
  }

  public async deleteFile(filePath: string): Promise<void> {
    this.logDebug(`Deleting file: ${filePath}`);
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      this.handleError(error, "delete", filePath);
    }
  }

  public async createDirectory(
    dirPath: string,
    recursive: boolean = true,
  ): Promise<void> {
    this.logDebug(`Creating directory: ${dirPath}`);
    try {
      await fs.promises.mkdir(dirPath, { recursive });
    } catch (error) {
      this.handleError(error, "create", dirPath);
    }
  }

  public resolvePath(...paths: string[]): string {
    return path.resolve(...paths);
  }

  public joinPath(...paths: string[]): string {
    return path.join(...paths);
  }

  public getRelativePath(from: string, to: string): string {
    return path.relative(from, to);
  }

  public getDirName(filePath: string): string {
    return path.dirname(filePath);
  }

  public getBaseName(filePath: string): string {
    return path.basename(filePath);
  }

  public getExtension(filePath: string): string {
    return path.extname(filePath);
  }

  public isAbsolute(filePath: string): boolean {
    return path.isAbsolute(filePath);
  }

  // Alternative method names that do the same thing
  public dirname(filePath: string): string {
    return this.getDirName(filePath);
  }

  public basename(filePath: string): string {
    return this.getBaseName(filePath);
  }

  public extname(filePath: string): string {
    return this.getExtension(filePath);
  }

  public validatePath(filePath: string, checkExists: boolean = true): void {
    if (!filePath) {
      const err = new ValidationError("Empty file path provided");
      this.deps.logger.error(err.message);
      throw err;
    }

    if (checkExists && !this.exists(filePath)) {
      const err = new ValidationError("File does not exist", { filePath });
      this.deps.logger.error(err.message);
      throw err;
    }
  }
}
