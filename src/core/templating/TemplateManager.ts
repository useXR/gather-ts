// src/core/templating/TemplateManager.ts
import { ValidationError } from "@/errors";
import { BaseService } from "@/types/services";
import {
  ITemplateManager,
  ITemplateManagerDeps,
  ITemplateManagerOptions,
  ITemplate,
  ITemplateContext,
} from "./interfaces/ITemplateManager";

export class TemplateManager extends BaseService implements ITemplateManager {
  private templates: Map<string, ITemplate> = new Map();
  private readonly debug: boolean;

  constructor(
    private readonly deps: ITemplateManagerDeps,
    options: ITemplateManagerOptions = {},
  ) {
    super();
    this.debug = options.debug || false;
  }

  public override async initialize(): Promise<void> {
    await super.initialize();
    this.logDebug("Initializing TemplateManager");
  }

  public override cleanup(): void {
    this.logDebug("Cleaning up TemplateManager");
    this.templates.clear();
    super.cleanup();
  }

  private logDebug(message: string): void {
    if (this.debug) {
      this.deps.logger.debug(`[TemplateManager] ${message}`);
    }
  }

  public registerTemplate(template: ITemplate): void {
    this.checkInitialized();

    if (this.templates.has(template.id)) {
      throw new ValidationError(
        `Template with ID ${template.id} already exists`,
      );
    }

    this.validateTemplate(template);
    this.templates.set(template.id, template);
    this.logDebug(`Registered template: ${template.id}`);
  }

  public getTemplate(id: string): ITemplate {
    this.checkInitialized();

    const template = this.templates.get(id);
    if (!template) {
      throw new ValidationError(`Template with ID ${id} not found`);
    }
    return template;
  }

  public hasTemplate(id: string): boolean {
    return this.templates.has(id);
  }

  public render(templateId: string, context: ITemplateContext): string {
    this.checkInitialized();

    const template = this.getTemplate(templateId);
    this.validateContext(template, context);
    const fullContext = this.applyDefaults(template, context);

    const result = this.renderTemplate(template.content, fullContext);
    this.logDebug(`Rendered template: ${templateId}`);

    return result;
  }

  private validateTemplate(template: ITemplate): void {
    if (!template.id || !template.content) {
      throw new ValidationError("Template must have id and content");
    }

    const declaredVars = new Set(template.variables.map(v => v.name));
    const usedVars = this.extractVariables(template.content);

    const undeclaredVars = [...usedVars].filter(v => !declaredVars.has(v));
    if (undeclaredVars.length > 0) {
      throw new ValidationError(
        `Template contains undeclared variables: ${undeclaredVars.join(", ")}`,
      );
    }
  }

  private validateContext(
    template: ITemplate,
    context: ITemplateContext,
  ): void {
    const requiredVars = template.variables.filter(v => v.required);

    for (const variable of requiredVars) {
      if (!(variable.name in context)) {
        throw new ValidationError(
          `Missing required variable: ${variable.name}`,
        );
      }
    }
  }

  private applyDefaults(
    template: ITemplate,
    context: ITemplateContext,
  ): ITemplateContext {
    const result = { ...context };

    for (const variable of template.variables) {
      if (!(variable.name in result) && variable.defaultValue !== undefined) {
        result[variable.name] = variable.defaultValue;
      }
    }

    return result;
  }

  private extractVariables(content: string): Set<string> {
    const varRegex = /\{\{([\w.-]+)\}\}/g;
    const variables = new Set<string>();
    let match;

    while ((match = varRegex.exec(content)) !== null) {
      variables.add(match[1]);
    }

    return variables;
  }

  private renderTemplate(content: string, context: ITemplateContext): string {
    return content.replace(/\{\{([\w.-]+)\}\}/g, (_, key) => {
      return context[key] || "";
    });
  }
}
