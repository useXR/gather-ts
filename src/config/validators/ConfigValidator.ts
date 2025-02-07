import { ValidationError } from "@/errors";
import { IConfigValidator } from "../interfaces/IConfigManager";
import {
  IGatherTSConfig,
  IOutputConfig,
  ICustomText,
  IConfigValidationResult,
} from "@/types/config";
import { TiktokenModel } from "@/types/models/tokenizer";

export class ConfigValidator implements IConfigValidator {
  public validateConfig(config: Partial<IGatherTSConfig>): void {
    // Validate required fields
    const requiredFields = ["tokenizer", "outputFormat"] as const;
    const missingFields = requiredFields.filter((field) => !(field in config));

    if (missingFields.length > 0) {
      throw new ValidationError("Missing required configuration fields", {
        missingFields,
      });
    }

    // Validate individual sections
    this.validateMaxDepth(config);
    this.validateTokenizerConfig(config);
    this.validateOutputFormat(config);
    this.validateCustomText(config);
  }

  private validateMaxDepth(config: Partial<IGatherTSConfig>): void {
    if (
      config.maxDepth !== undefined &&
      (typeof config.maxDepth !== "number" || config.maxDepth < 0)
    ) {
      throw new ValidationError("Invalid maxDepth value", {
        maxDepth: config.maxDepth,
        expectedType: "positive number or undefined",
      });
    }
  }

  public validateTokenizerConfig(config: Partial<IGatherTSConfig>): void {
    const validModels: TiktokenModel[] = [
      "gpt-3.5-turbo",
      "gpt-4",
      "gpt-4o",
      "gpt-4o-mini",
      "o1",
      "o1-mini",
      "o3-mini",
    ];

    if (!config.tokenizer) {
      throw new ValidationError("Missing tokenizer configuration");
    }

    if (!validModels.includes(config.tokenizer.model)) {
      throw new ValidationError("Invalid tokenizer model", {
        providedModel: config.tokenizer.model,
        validModels,
      });
    }

    if (
      config.tokenizer.showWarning !== undefined &&
      typeof config.tokenizer.showWarning !== "boolean"
    ) {
      throw new ValidationError(
        "Invalid showWarning value in tokenizer config",
        {
          providedValue: config.tokenizer.showWarning,
          expectedType: "boolean",
        },
      );
    }
  }

  public validateOutputFormat(config: Partial<IGatherTSConfig>): void {
    if (!config.outputFormat) {
      throw new ValidationError("Missing output format configuration");
    }

    const formatKeys: Array<keyof IOutputConfig> = [
      "includeSummaryInFile",
      "includeGenerationTime",
      "includeUsageGuidelines",
    ];

    formatKeys.forEach((key) => {
      if (
        config.outputFormat?.[key] !== undefined &&
        typeof config.outputFormat[key] !== "boolean"
      ) {
        throw new ValidationError(`Invalid outputFormat.${key} value`, {
          value: config.outputFormat[key],
          expectedType: "boolean",
        });
      }
    });

    if (
      config.outputFormat.format !== undefined &&
      !["json", "text", "markdown"].includes(config.outputFormat.format)
    ) {
      throw new ValidationError("Invalid output format", {
        providedValue: config.outputFormat.format,
        allowedValues: ["json", "text", "markdown"],
      });
    }
  }

  public validateCustomText(config: Partial<IGatherTSConfig>): void {
    if (!config.customText) {
      return;
    }

    const textKeys: Array<keyof ICustomText> = [
      "header",
      "footer",
      "beforeSummary",
      "afterSummary",
      "beforeFiles",
    ];

    textKeys.forEach((key) => {
      if (
        config.customText![key] !== undefined &&
        typeof config.customText![key] !== "string"
      ) {
        throw new ValidationError(`Invalid customText.${key} value`, {
          value: config.customText![key],
          expectedType: "string",
        });
      }
    });
  }

  private validateRequiredFiles(config: Partial<IGatherTSConfig>): void {
    if (!config.requiredFiles) {
      return;
    }

    if (!Array.isArray(config.requiredFiles)) {
      throw new ValidationError("requiredFiles must be an array", {
        providedValue: config.requiredFiles,
        expectedType: "array",
      });
    }

    config.requiredFiles.forEach((file, index) => {
      if (typeof file !== "string") {
        throw new ValidationError(`Invalid required file at index ${index}`, {
          providedValue: file,
          expectedType: "string",
        });
      }
    });
  }

  public validateAll(
    config: Partial<IGatherTSConfig>,
  ): IConfigValidationResult {
    const result: IConfigValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    try {
      this.validateConfig(config);
    } catch (error) {
      result.isValid = false;
      if (error instanceof ValidationError) {
        result.errors.push(error.message);
        if (error.details) {
          result.errors.push(JSON.stringify(error.details));
        }
      } else {
        result.errors.push(
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    // Add warnings for potentially problematic configurations
    if (config.maxDepth !== undefined && config.maxDepth > 10) {
      result.warnings.push("High maxDepth value may impact performance");
    }

    if (config.topFilesCount && config.topFilesCount > 20) {
      result.warnings.push("Large topFilesCount value may impact readability");
    }

    return result;
  }
}
