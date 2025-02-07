// src/core/templating/interfaces/ITemplateManager.ts
import { IService } from "@/types/services";
import { ILogger } from "@/utils/logging/interfaces/ILogger";

export interface ITemplateVariable {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
}

export interface ITemplate {
  id: string;
  content: string;
  variables: ITemplateVariable[];
  description?: string;
}

export interface ITemplateContext {
  [key: string]: string;
}

export interface ITemplateManagerDeps {
  logger: ILogger;
}

export interface ITemplateManagerOptions {
  debug?: boolean;
}

export interface ITemplateManager extends IService {
  registerTemplate(template: ITemplate): void;
  getTemplate(id: string): ITemplate;
  render(templateId: string, context: ITemplateContext): string;
  hasTemplate(id: string): boolean;
}