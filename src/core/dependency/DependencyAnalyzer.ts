import madge from 'madge';
import { logger } from '@/utils/logging';
import { fileSystem } from '@/utils/filesystem/FileSystem';
import { IDependencyMap } from '@/types/compiler';
import { DependencyAnalysisError, ValidationError } from '@/errors';
import { IFileSystem } from '@/utils/filesystem/interfaces/IFileSystem';
import { IDependencyAnalyzer } from './interfaces/IDependencyAnalyzer';
import { IIgnoreHandler } from './interfaces/IIgnoreHandler';

export class DependencyAnalyzer implements IDependencyAnalyzer {
  private readonly ignoreHandler: IIgnoreHandler;
  private readonly fs: IFileSystem;

  constructor(ignoreHandler: IIgnoreHandler, fs: IFileSystem = fileSystem) {
    this.ignoreHandler = ignoreHandler;
    this.fs = fs;
  }

  public async validateEntryFiles(entryFiles: string[], rootDir: string): Promise<string[]> {
    const validatedFiles = [];
    
    for (const file of entryFiles) {
      const resolvedPath = this.fs.resolvePath(rootDir, file.trim());
      
      if (!this.fs.exists(resolvedPath)) {
        throw new ValidationError('Entry file not found', { file: resolvedPath });
      }
      
      if (this.ignoreHandler.shouldIgnore(resolvedPath)) {
        throw new ValidationError('Entry file is ignored', { 
          file: resolvedPath,
          ignorePatterns: this.ignoreHandler.getPatterns()
        });
      }
      
      validatedFiles.push(resolvedPath);
    }
    
    return validatedFiles;
  }

  public async analyzeDependencies(entryFiles: string | string[], projectRoot: string): Promise<IDependencyMap> {
    const originalCwd = process.cwd();
    // Change to the project root before running madge
    process.chdir(projectRoot);
  
    try {
      const files = Array.isArray(entryFiles) ? entryFiles : [entryFiles];
      // Make sure paths are relative to project root
      const relativeFiles = files.map(file => this.fs.getRelativePath(projectRoot, file));
      
      const ignorePatterns = this.ignoreHandler.getPatterns().map(pattern => 
        new RegExp(pattern
          .replace(/\./g, '\\.')
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*')
          .replace(/\?/g, '.')
        )
      );
  
      const dependencyMaps = await Promise.all(
        relativeFiles.map(async (entryFile) => {
          const madgeResult = await madge(entryFile, {
            baseDir: projectRoot,
            tsConfig: this.fs.joinPath(projectRoot, 'tsconfig.json'),
            fileExtensions: ['ts', 'tsx'],
            excludeRegExp: [/node_modules/, ...ignorePatterns],
            detectiveOptions: {
              ts: { mixedImports: true },
              tsx: { mixedImports: true }
            }
          });
  
          return await madgeResult.obj();
        })
      );
  
      // Merge all dependency maps
      const mergedDeps: IDependencyMap = {};
      
      dependencyMaps.forEach((deps) => {
        Object.entries(deps).forEach(([file, dependencies]) => {
          const absFile = this.fs.resolvePath(projectRoot, file);
          
          if (!this.ignoreHandler.shouldIgnore(absFile)) {
            const nonIgnoredDeps = dependencies
              .map(dep => this.fs.resolvePath(projectRoot, dep))
              .filter(dep => !this.ignoreHandler.shouldIgnore(dep));
            
            if (nonIgnoredDeps.length > 0) {
              if (mergedDeps[absFile]) {
                mergedDeps[absFile] = [...new Set([...mergedDeps[absFile], ...nonIgnoredDeps])];
              } else {
                mergedDeps[absFile] = nonIgnoredDeps;
              }
            }
          }
        });
      });
      
      return mergedDeps;
    } catch (error) {
      const entryFile = Array.isArray(entryFiles) ? entryFiles[0] : entryFiles;
      const failedDependencies = Array.isArray(entryFiles) ? entryFiles : [entryFiles];
      throw new DependencyAnalysisError(
        `Failed to analyze dependencies: ${error instanceof Error ? error.message : String(error)}`,
        entryFile,
        failedDependencies
      );
    } finally {
      process.chdir(originalCwd);
    }
  }
  

  public async gatherDependencies(
    adjacencyList: IDependencyMap,
    entryFiles: string[],
    maxDepth?: number
  ): Promise<string[]> {
    const queue: Array<{ file: string; depth: number }> = [];
    const visited = new Set<string>();

    for (const file of entryFiles) {
      if (!this.ignoreHandler.shouldIgnore(file)) {
        queue.push({ file, depth: 0 });
        visited.add(file);
      }
    }

    while (queue.length > 0) {
      const { file, depth } = queue.shift()!;
      if (maxDepth !== undefined && depth >= maxDepth) continue;

      const children = adjacencyList[file] || [];
      for (const child of children) {
        if (!this.ignoreHandler.shouldIgnore(child) && !visited.has(child)) {
          visited.add(child);
          queue.push({ file: child, depth: depth + 1 });
        }
      }
    }

    return Array.from(visited);
  }
}