import micromatch from "micromatch";
import { FileSystemError, ValidationError } from "@/errors";
import { logger } from "@/utils/logging";
import { fileSystem } from "@/utils/filesystem/FileSystem";
import {
  IIgnoreHandler,
  IIgnorePatternValidator,
  IIgnoreHandlerOptions,
  IPatternValidationResult,
} from "./interfaces/IIgnoreHandler";
import { IFileSystem } from "@/utils/filesystem/interfaces/IFileSystem";

export class IgnoreHandler implements IIgnoreHandler, IIgnorePatternValidator {
  private patterns: string[] = [];
  private readonly projectRoot: string;
  private readonly debug: boolean;
  private readonly fs: IFileSystem;

  constructor(
    projectRoot: string,
    options: IIgnoreHandlerOptions = {},
    fs: IFileSystem = fileSystem
  ) {
    if (!projectRoot || typeof projectRoot !== "string") {
      throw new ValidationError("Invalid project root", { projectRoot });
    }

    if (!fs.exists(projectRoot)) {
      throw new ValidationError("Project root does not exist", { projectRoot });
    }

    this.projectRoot = projectRoot;
    this.debug = options.debug || false;
    this.fs = fs;

    this.loadIgnorePatterns(projectRoot);

    if (options.extraPatterns) {
      options.extraPatterns.forEach((pattern) => this.addPattern(pattern));
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
        `Invalid ignore pattern syntax: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { pattern }
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

  private loadIgnoreFile(filePath: string): string[] {
    try {
      if (!this.fs.exists(filePath)) {
        return [];
      }

      const content = this.fs.readFileSync(filePath, "utf8");
      return content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));
    } catch (error) {
      throw new FileSystemError(
        `Failed to read ignore file: ${
          error instanceof Error ? error.message : String(error)
        }`,
        filePath,
        "read"
      );
    }
  }

  private processPatterns(patterns: string[], source: string): string[] {
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
        `Failed to process patterns from ${source}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { source, patterns }
      );
    }
  }

  private loadIgnorePatterns(projectRoot: string): void {
    const deppackIgnorePath = this.fs.joinPath(projectRoot, ".deppackignore");
    const gitignorePath = this.fs.joinPath(projectRoot, ".gitignore");

    try {
      // Load patterns from both files
      const deppackPatterns = this.loadIgnoreFile(deppackIgnorePath);
      const gitignorePatterns = this.loadIgnoreFile(gitignorePath);

      // Process patterns from each source
      const processedDeppackPatterns = this.processPatterns(
        deppackPatterns,
        ".deppackignore"
      );
      const processedGitignorePatterns = this.processPatterns(
        gitignorePatterns,
        ".gitignore"
      );

      // Combine all patterns
      this.patterns = [
        ...processedDeppackPatterns,
        ...processedGitignorePatterns,
        "node_modules/**",
        ".git/**",
      ];

      // Remove duplicates while preserving order
      this.patterns = [...new Set(this.patterns)];

      if (deppackPatterns.length > 0 || gitignorePatterns.length > 0) {
        logger.info("\nLoaded ignore patterns from:");
        if (deppackPatterns.length > 0) {
          logger.info(`- .deppackignore (${deppackPatterns.length} patterns)`);
        }
        if (gitignorePatterns.length > 0) {
          logger.info(`- .gitignore (${gitignorePatterns.length} patterns)`);
        }
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        `Failed to load ignore patterns: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  public shouldIgnore(filePath: string): boolean {
    this.validateFilePath(filePath);

    try {
      const relativePath = this.fs
        .getRelativePath(this.projectRoot, filePath)
        .split(this.fs.getDirName("/"))
        .join("/");

      if (relativePath.includes("node_modules")) {
        return true;
      }

      if (this.debug) {
        logger.debug(`\nChecking '${relativePath}'...`);
      }

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
              return false;
            }
            if (this.debug) {
              logger.debug(`File will be ignored due to pattern: '${pattern}'`);
            }
            return true;
          }
        } catch (error) {
          logger.warn(
            `Pattern matching error for '${pattern}': ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          continue;
        }
      }

      if (this.debug && lastMatchedPattern) {
        if (wasNegated) {
          logger.debug(
            `File will be included due to negation pattern: '${lastMatchedPattern}'`
          );
        }
      }

      return false;
    } catch (error) {
      throw new ValidationError(
        `Error checking ignore status: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { filePath }
      );
    }
  }

  public validateFilePath(filePath: string): void {
    if (!filePath) {
      throw new ValidationError("Empty file path provided");
    }

    try {
      const absolutePath = this.fs.resolvePath(
        this.fs.isAbsolute(filePath) ? "" : this.projectRoot,
        filePath
      );

      if (!this.fs.exists(absolutePath)) {
        throw new ValidationError("File does not exist", {
          filePath: absolutePath,
        });
      }

      if (!this.fs.isReadable(absolutePath)) {
        throw new ValidationError("File is not readable", {
          filePath: absolutePath,
        });
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        `Failed to validate file path: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { filePath }
      );
    }
  }

  public getPatterns(): string[] {
    return [...this.patterns];
  }

  public addPattern(pattern: string): void {
    try {
      const validatedPattern = this.validatePattern(pattern);
      if (!this.patterns.includes(validatedPattern)) {
        this.patterns.push(validatedPattern);
        if (this.debug) {
          logger.debug(`Added ignore pattern: ${validatedPattern}`);
        }
      }
    } catch (error) {
      throw new ValidationError(
        `Failed to add ignore pattern: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { pattern }
      );
    }
  }

  public removePattern(pattern: string): boolean {
    const index = this.patterns.indexOf(pattern);
    if (index !== -1) {
      this.patterns.splice(index, 1);
      if (this.debug) {
        logger.debug(`Removed ignore pattern: ${pattern}`);
      }
      return true;
    }
    return false;
  }

  public resetPatterns(): void {
    this.patterns = ["node_modules/**", ".git/**"];
    if (this.debug) {
      logger.debug("Reset ignore patterns to defaults");
    }
  }

  public printDebugInfo(filePath: string): void {
    this.validateFilePath(filePath);

    try {
      const relativePath = this.fs
        .getRelativePath(this.projectRoot, filePath)
        .split(this.fs.getDirName("/"))
        .join("/");

      logger.debug("\nDebug Information:");
      logger.debug("----------------");
      logger.debug(`File: ${relativePath}`);
      logger.debug(`Project Root: ${this.projectRoot}`);
      logger.debug("\nTesting patterns:");

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

      // Log match results
      matchResults.forEach(({ pattern, isMatch, error }) => {
        if (error) {
          logger.debug(`! ERROR: ${pattern} - ${error}`);
        } else {
          logger.debug(`${isMatch ? "✓" : "✗"} ${pattern}`);
        }
      });

      // Log negation patterns separately
      const negationPatterns = matchResults.filter(
        ({ pattern, isMatch }) => pattern.startsWith("!") && isMatch
      );

      if (negationPatterns.length > 0) {
        logger.debug("\nNegation patterns matched:");
        negationPatterns.forEach(({ pattern }) => {
          logger.debug(`! ${pattern}`);
        });
      }

      // Log final decision
      const isIgnored = this.shouldIgnore(filePath);
      logger.debug("\nFinal result:");
      logger.debug(`File will be ${isIgnored ? "IGNORED" : "INCLUDED"}`);
    } catch (error) {
      throw new ValidationError(
        `Failed to print debug info: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { filePath }
      );
    }
  }
}
