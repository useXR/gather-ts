export interface IFileSystemOptions {
  encoding?: BufferEncoding;
  flag?: string;
}

export interface IFileSystem {
  isAbsolute(path: string): boolean;
  dirname(path: string): string;
  basename(path: string): string;
  extname(path: string): string;

  // Synchronous operations
  readFileSync(filePath: string, encoding?: BufferEncoding): string;
  writeFileSync(
    filePath: string,
    data: string | Buffer,
    options?: IFileSystemOptions
  ): void;
  exists(path: string): boolean;
  isReadable(filePath: string): boolean;
  isWritable(filePath: string): boolean;

  // Asynchronous operations
  readFile(filePath: string, options?: IFileSystemOptions): Promise<string>;
  writeFile(
    filePath: string,
    data: string | Buffer,
    options?: IFileSystemOptions
  ): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  createDirectory(dirPath: string, recursive?: boolean): Promise<void>;

  // Path operations
  resolvePath(...paths: string[]): string;
  joinPath(...paths: string[]): string;
  getRelativePath(from: string, to: string): string;
  getDirName(path: string): string;
  getBaseName(path: string): string;
  getExtension(path: string): string;

  // Validation
  validatePath(filePath: string, checkExists?: boolean): void;
}
