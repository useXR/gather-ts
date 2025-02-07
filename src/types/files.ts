export interface IFileInfo {
  absolute: string;
  relative: string;
  path: string;
  size?: number;
  extension?: string;
  lastModified?: Date;
}

export interface IFileWithContent extends IFileInfo {
  content: string;
  hash?: string;
}

export interface IFileStats {
  path: string;
  chars: number;
  tokens: number;
  lines?: number;
  size?: number;
}

export interface IProcessedFile extends IFileWithContent {
  stats: IFileStats;
}

export interface IOutputContent {
  header?: string;
  summary?: string;
  fileList: string[];
  fileContents: IFileWithContent[];
  stats?: IFileStats;
  footer?: string;
}

export interface IFileBatch {
  files: IFileInfo[];
  totalSize: number;
  batchNumber: number;
}

export type FileType =
  | "typescript"
  | "javascript"
  | "json"
  | "markdown"
  | "text"
  | "unknown";

export interface IFileTypeInfo {
  type: FileType;
  extension: string;
  binary: boolean;
  processable: boolean;
}
