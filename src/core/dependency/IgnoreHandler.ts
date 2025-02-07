// src/core/dependency/IgnoreHandler.ts

import micromatch from "micromatch";
import { FileSystemError, ValidationError } from "@/errors";
import {
  IIgnoreHandler,
  IIgnoreHandlerDeps,
  IIgnoreHandlerOptions,
  IIgnorePatternValidator,
  IPatternValidationResult,
  ILoadPatternsOptions,
} from "./interfaces/IIgnoreHandler";
import { BaseService } from "@/types/services";

export class IgnoreHandler
  extends BaseService
  implements IIgnoreHandler, IIgnorePatternValidator
{
  private patterns: string[] = [];
  private readonly projectRoot: string;
  private readonly debug: boolean;

  constructor(
    projectRoot: string,
    private readonly deps: IIgnoreHandlerDeps,
    options: IIgnoreHandlerOptions = {},
  ) {
    super();
    if (!projectRoot || typeof projectRoot !== "string") {
      throw new ValidationError("Invalid project root", { projectRoot });
    }

    this.projectRoot = projectRoot;
    this.debug = options.debug || false;

    // Defer pattern loading to initialize()
    if (options.extraPatterns) {
      this.logDebug(`Received ${options.extraPatterns.length} extra patterns`);
      this.patterns = [...options.extraPatterns];
    }
  }

  public override async initialize(): Promise<void> {
    await super.initialize();
    this.logDebug("Initializing IgnoreHandler");

    try {
      if (!this.deps.fileSystem.exists(this.projectRoot)) {
        throw new ValidationError("Project root does not exist", {
          projectRoot: this.projectRoot,
        });
      }

      await this.loadIgnorePatterns();
      this.logDebug("IgnoreHandler initialization complete");
    } catch (error) {
      throw new ValidationError(
        `Failed to initialize IgnoreHandler: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public override cleanup(): void {
    this.logDebug("Cleaning up IgnoreHandler");
    this.patterns = [];
    super.cleanup();
  }

  private logDebug(message: string): void {
    if (this.debug) {
      this.deps.logger.debug(message);
    }
  }

  private async loadIgnorePatterns(
    options: ILoadPatternsOptions = {},
  ): Promise<void> {
    const gatherTSIgnorePath = this.deps.fileSystem.joinPath(
      this.projectRoot,
      ".gather-ts-ignore",
    );
    const gitignorePath = this.deps.fileSystem.joinPath(
      this.projectRoot,
      ".gitignore",
    );

    try {
      this.logDebug("Loading ignore patterns");

      // Load patterns from both files
      const gatherTSPatterns = await this.loadIgnoreFile(gatherTSIgnorePath);
      const gitignorePatterns = options.skipGitignore
        ? []
        : await this.loadIgnoreFile(gitignorePath);

      // Process patterns from each source
      const processedGatherTSPatterns = this.processPatterns(
        gatherTSPatterns,
        ".gather-ts-ignore",
      );
      const processedGitignorePatterns = this.processPatterns(
        gitignorePatterns,
        ".gitignore",
      );

      // Combine all patterns
      const defaultPatterns = ["node_modules/**", ".git/**"];
      this.patterns = [
        ...defaultPatterns,
        ...processedGatherTSPatterns,
        ...processedGitignorePatterns,
        ...this.patterns, // Keep any extra patterns added in constructor
      ];

      // Remove duplicates while preserving order
      this.patterns = [...new Set(this.patterns)];

      if (gatherTSPatterns.length > 0 || gitignorePatterns.length > 0) {
        this.deps.logger.info("\nLoaded ignore patterns from:");
        if (gatherTSPatterns.length > 0) {
          this.deps.logger.info(
            `- .gather-ts-ignore (${gatherTSPatterns.length} patterns)`,
          );
        }
        if (gitignorePatterns.length > 0) {
          this.deps.logger.info(
            `- .gitignore (${gitignorePatterns.length} patterns)`,
          );
        }
      }

      this.logDebug(`Total patterns loaded: ${this.patterns.length}`);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        `Failed to load ignore patterns: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async loadIgnoreFile(filePath: string): Promise<string[]> {
    try {
      if (!this.deps.fileSystem.exists(filePath)) {
        this.logDebug(`Ignore file not found: ${filePath}`);
        return [];
      }

      const content = await this.deps.fileSystem.readFile(filePath, {
        encoding: "utf8",
      });
      const patterns = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));

      this.logDebug(`Loaded ${patterns.length} patterns from ${filePath}`);
      return patterns;
    } catch (error) {
      throw new FileSystemError(
        `Failed to read ignore file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        "read",
      );
    }
  }

  public validatePattern(pattern: string): string {
    if (typeof pattern !== "string") {
      throw new ValidationError("Invalid ignore pattern", { pattern });
    }

    // Remove any leading ./ from the pattern
    pattern = pattern.replace(/^\.\//, "");

    // Validate pattern syntax
    try {
      micromatch(["test"], pattern);
      return pattern;
    } catch (error) {
      throw new ValidationError(
        `Invalid ignore pattern syntax: ${error instanceof Error ? error.message : String(error)}`,
        { pattern },
      );
    }
  }

  public parsePattern(pattern: string): IPatternValidationResult {
    try {
      const normalizedPattern = this.validatePattern(pattern);
      return {
        isValid: true,
        normalizedPattern,
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  public validatePatterns(patterns: string[]): string[] {
    this.logDebug(`Validating ${patterns.length} patterns`);

    const validPatterns: string[] = [];
    const errors: string[] = [];

    patterns.forEach((pattern) => {
      const result = this.parsePattern(pattern);
      if (result.isValid && result.normalizedPattern) {
        validPatterns.push(result.normalizedPattern);
      } else {
        errors.push(`Invalid pattern "${pattern}": ${result.error}`);
      }
    });

    if (errors.length > 0) {
      throw new ValidationError("Invalid patterns found", { errors });
    }

    return validPatterns;
  }

  private processPatterns(patterns: string[], source: string): string[] {
    this.logDebug(`Processing patterns from ${source}`);

    try {
      return patterns.reduce((acc: string[], pattern: string) => {
        pattern = this.validatePattern(pattern);

        // Don't modify negation patterns
        if (pattern.startsWith("!")) {
          acc.push(pattern);
          return acc;
        }

        // For directory patterns ending with /, add the directory and its contents
        if (pattern.endsWith("/")) {
          acc.push(pattern);
          acc.push(`${pattern}**`);
          return acc;
        }

        // For patterns that already have globs or path separators, add as-is
        if (pattern.includes("*") || pattern.includes("/")) {
          acc.push(pattern);
          return acc;
        }

        // For simple patterns, add both the exact match and the **/ version
        acc.push(pattern);
        acc.push(`**/${pattern}`);

        return acc;
      }, []);
    } catch (error) {
      throw new ValidationError(
        `Failed to process patterns from ${source}: ${error instanceof Error ? error.message : String(error)}`,
        { source, patterns },
      );
    }
  }

  public shouldIgnore(filePath: string): boolean {
    if (!this.isInitialized) {
      throw new ValidationError("IgnoreHandler not initialized");
    }

    this.validateFilePath(filePath);

    try {
      const relativePath = this.deps.fileSystem
        .getRelativePath(this.projectRoot, filePath)
        .split(this.deps.fileSystem.getDirName("/"))
        .join("/");

      if (relativePath.includes("node_modules")) {
        return true;
      }

      this.logDebug(`Checking '${relativePath}'...`);

      let lastMatchedPattern: string | null = null;
      let wasNegated = false;

      for (const pattern of this.patterns) {
        try {
          const isMatch = micromatch.isMatch(relativePath, pattern, {
            dot: true,
            matchBase: true,
          });

          if (isMatch) {
            lastMatchedPattern = pattern;
            if (pattern.startsWith("!")) {
              wasNegated = true;
              this.logDebug(`File included by negation pattern: '${pattern}'`);
              return false;
            }
            this.logDebug(`File will be ignored due to pattern: '${pattern}'`);
            return true;
          }
        } catch (error) {
          this.deps.logger.warn(
            `Pattern matching error for '${pattern}': ${error instanceof Error ? error.message : String(error)}`,
          );
          continue;
        }
      }

      if (lastMatchedPattern) {
        this.logDebug(
          wasNegated
            ? `File included by negation pattern: '${lastMatchedPattern}'`
            : `File matched pattern: '${lastMatchedPattern}'`,
        );
      }

      return false;
    } catch (error) {
      throw new ValidationError(
        `Error checking ignore status: ${error instanceof Error ? error.message : String(error)}`,
        { filePath },
      );
    }
  }

  public validateFilePath(filePath: string): void {
    if (!filePath) {
      throw new ValidationError("Empty file path provided");
    }

    try {
      const absolutePath = this.deps.fileSystem.resolvePath(
        this.deps.fileSystem.isAbsolute(filePath) ? "" : this.projectRoot,
        filePath,
      );

      if (!this.deps.fileSystem.exists(absolutePath)) {
        throw new ValidationError("File does not exist", {
          filePath: absolutePath,
        });
      }

      if (!this.deps.fileSystem.isReadable(absolutePath)) {
        throw new ValidationError("File is not readable", {
          filePath: absolutePath,
        });
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        `Failed to validate file path: ${error instanceof Error ? error.message : String(error)}`,
        { filePath },
      );
    }
  }

  public getPatterns(): string[] {
    return [...this.patterns];
  }

  public addPattern(pattern: string): void {
    this.logDebug(`Adding pattern: ${pattern}`);

    try {
      const validatedPattern = this.validatePattern(pattern);
      if (!this.patterns.includes(validatedPattern)) {
        this.patterns.push(validatedPattern);
        this.logDebug(`Added pattern: ${validatedPattern}`);
      }
    } catch (error) {
      throw new ValidationError(
        `Failed to add ignore pattern: ${error instanceof Error ? error.message : String(error)}`,
        { pattern },
      );
    }
  }

  public removePattern(pattern: string): boolean {
    this.logDebug(`Removing pattern: ${pattern}`);

    const index = this.patterns.indexOf(pattern);
    if (index !== -1) {
      this.patterns.splice(index, 1);
      this.logDebug(`Removed pattern: ${pattern}`);
      return true;
    }
    return false;
  }

  public resetPatterns(): void {
    this.logDebug("Resetting patterns to defaults");
    this.patterns = ["node_modules/**", ".git/**"];
  }

  public printDebugInfo(filePath: string): void {
    try {
      this.validateFilePath(filePath);

      const relativePath = this.deps.fileSystem
        .getRelativePath(this.projectRoot, filePath)
        .split(this.deps.fileSystem.getDirName("/"))
        .join("/");

      this.deps.logger.debug("\nDebug Information:");
      this.deps.logger.debug("----------------");
      this.deps.logger.debug(`File: ${relativePath}`);
      this.deps.logger.debug(`Project Root: ${this.projectRoot}`);
      this.deps.logger.debug("\nTesting patterns:");

      const matchResults = this.patterns.map((pattern) => {
        try {
          const isMatch = micromatch.isMatch(relativePath, pattern, {
            dot: true,
            matchBase: true,
          });
          return {
            pattern,
            isMatch,
            error: null,
          };
        } catch (error) {
          return {
            pattern,
            isMatch: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      matchResults.forEach(({ pattern, isMatch, error }) => {
        if (error) {
          this.deps.logger.debug(`! ERROR: ${pattern} - ${error}`);
        } else {
          this.deps.logger.debug(`${isMatch ? "✓" : "✗"} ${pattern}`);
        }
      });

      const negationPatterns = matchResults.filter(
        ({ pattern, isMatch }) => pattern.startsWith("!") && isMatch,
      );

      if (negationPatterns.length > 0) {
        this.deps.logger.debug("\nNegation patterns matched:");
        negationPatterns.forEach(({ pattern }) => {
          this.deps.logger.debug(`! ${pattern}`);
        });
      }

      const isIgnored = this.shouldIgnore(filePath);
      this.deps.logger.debug("\nFinal result:");
      this.deps.logger.debug(
        `File will be ${isIgnored ? "IGNORED" : "INCLUDED"}`,
      );
    } catch (error) {
      throw new ValidationError(
        `Failed to print debug info: ${error instanceof Error ? error.message : String(error)}`,
        { filePath },
      );
    }
  }
}
