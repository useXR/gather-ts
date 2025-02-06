import { IErrorDetails } from "errors";

export interface IValidationErrorDetails extends IErrorDetails {
    filePath?: string;
    providedValue?: unknown;
    expectedType?: string;
    allowedValues?: unknown[];
  }
  
  export interface IFileSystemErrorDetails extends IErrorDetails {
    filePath: string;
    operation: 'read' | 'write' | 'delete' | 'create' | 'move' | 'copy';
  }
  
  export interface IConfigurationErrorDetails extends IErrorDetails {
    configPath: string;
    invalidFields?: string[];
    providedValue?: unknown;
    allowedValues?: unknown[];
  }
  
  export interface ITokenizationErrorDetails extends IErrorDetails {
    filePath: string;
    operation: 'encode' | 'decode' | 'initialize' | 'cleanup';
    model?: string;
  }
  
  export interface IDependencyAnalysisErrorDetails extends IErrorDetails {
    entryPoint?: string;
    failedDependencies?: string[];
  }
  
  export interface ICacheErrorDetails extends IErrorDetails {
    operation: 'read' | 'write' | 'delete' | 'clear' | 'expire' | "initialize";
    key?: string;
  }
  
  export interface ICompilationErrorDetails extends IErrorDetails {
    phase: 'initialization' | 'dependency-analysis' | 'file-processing' | 'tokenization' | 'output-generation';
    filePath?: string;
    sourceCode?: string;
    lineNumber?: number;
    columnNumber?: number;
  }