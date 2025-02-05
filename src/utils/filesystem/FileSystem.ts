import fs from 'fs';
import path from 'path';
import { FileSystemError, ValidationError } from '@/errors';
import { IFileSystem, IFileSystemOptions } from './interfaces/IFileSystem';

export class FileSystem implements IFileSystem {
  public readFileSync(filePath: string, encoding: BufferEncoding = 'utf8'): string {
    try {
      return fs.readFileSync(filePath, encoding);
    } catch (error) {
      throw new FileSystemError(
        `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        'read'
      );
    }
  }

  public writeFileSync(filePath: string, data: string | Buffer, options?: IFileSystemOptions): void {
    try {
      const dir = this.getDirName(filePath);
      if (!this.exists(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, data, options);
    } catch (error) {
      throw new FileSystemError(
        `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        'write'
      );
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

  public async readFile(filePath: string, options?: IFileSystemOptions): Promise<string> {
    try {
      const buffer = await fs.promises.readFile(filePath, options);
      return buffer.toString(options?.encoding || 'utf8');
    } catch (error) {
      throw new FileSystemError(
        `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        'read'
      );
    }
  }

  public async writeFile(filePath: string, data: string | Buffer, options?: IFileSystemOptions): Promise<void> {
    try {
      const dir = this.getDirName(filePath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(filePath, data, options);
    } catch (error) {
      throw new FileSystemError(
        `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        'write'
      );
    }
  }

  public async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      throw new FileSystemError(
        `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        'delete'
      );
    }
  }

  public async createDirectory(dirPath: string, recursive: boolean = true): Promise<void> {
    try {
      await fs.promises.mkdir(dirPath, { recursive });
    } catch (error) {
      throw new FileSystemError(
        `Failed to create directory: ${error instanceof Error ? error.message : String(error)}`,
        dirPath,
        'create'
      );
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

  public dirname(filePath: string): string {
    return path.dirname(filePath);
  }

  public basename(filePath: string): string {
    return path.basename(filePath);
  }

  public extname(filePath: string): string {
    return path.extname(filePath);
  }

  public validatePath(filePath: string, checkExists: boolean = true): void {
    if (!filePath) {
      throw new ValidationError('Empty file path provided');
    }

    if (checkExists && !this.exists(filePath)) {
      throw new ValidationError('File does not exist', { filePath });
    }
  }
}

// Export a default instance
export const fileSystem = new FileSystem();