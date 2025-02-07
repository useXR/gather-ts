// src/utils/logging/Logger.ts

import { BaseService } from "@/types/services";
import {
  ILogger,
  ILoggerOptions,
  ILoggerDeps,
  ILogColors,
  LogLevel,
} from "./interfaces/ILogger";

export class Logger extends BaseService implements ILogger {
  private readonly colors: ILogColors;
  private readonly timestamp: boolean;
  private readonly logLevel: LogLevel;
  private debugEnabled: boolean;

  constructor(
    private readonly deps: ILoggerDeps,
    options: ILoggerOptions = {}
  ) {
    super();
    this.colors = {
      reset: "\x1b[0m",
      bright: "\x1b[1m",
      dim: "\x1b[2m",
      blue: "\x1b[34m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      red: "\x1b[31m",
      gray: "\x1b[90m",
      ...options.colors,
    };
    this.debugEnabled = options.enableDebug || false;
    this.timestamp = options.timestamp || false;
    this.logLevel = options.logLevel || "info";
  }

  public override async initialize(): Promise<void> {
    await super.initialize();
    if (this.debugEnabled) {
      this.debug("Logger initialized");
    }
  }

  public override cleanup(): void {
    if (this.debugEnabled) {
      this.debug("Logger cleanup");
    }
    super.cleanup();
  }

  private format(color: keyof ILogColors, message: string): string {
    return `${this.colors[color]}${message}${this.colors.reset}`;
  }

  private formatWithTimestamp(message: string): string {
    if (!this.timestamp) return message;
    const timestamp = new Date().toISOString();
    return `[${timestamp}] ${message}`;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    const currentLevel = levels.indexOf(this.logLevel);
    const messageLevel = levels.indexOf(level);
    return messageLevel >= currentLevel;
  }

  public info(message: string): void {
    if (!this.shouldLog("info")) return;
    const formattedMessage = this.formatWithTimestamp(
      this.format("blue", "ℹ") + " " + message
    );
    this.deps.outputStream.write(formattedMessage + "\n");
  }

  public success(message: string): void {
    if (!this.shouldLog("info")) return;
    const formattedMessage = this.formatWithTimestamp(
      this.format("green", "✓") + " " + message
    );
    this.deps.outputStream.write(formattedMessage + "\n");
  }

  public warn(message: string): void {
    if (!this.shouldLog("warn")) return;
    const formattedMessage = this.formatWithTimestamp(
      this.format("yellow", "⚠") + " " + message
    );
    this.deps.outputStream.write(formattedMessage + "\n");
  }

  public error(message: string): void {
    if (!this.shouldLog("error")) return;
    const formattedMessage = this.formatWithTimestamp(
      this.format("red", "✖") + " " + message
    );
    this.deps.errorStream.write(formattedMessage + "\n");
  }

  public debug(message: string): void {
    if (!this.debugEnabled || !this.shouldLog("debug")) return;
    const formattedMessage = this.formatWithTimestamp(
      this.format("gray", "→") + " " + message
    );
    this.deps.outputStream.write(formattedMessage + "\n");
  }

  public section(title: string): void {
    if (!this.shouldLog("info")) return;
    this.deps.outputStream.write("\n" + this.format("bright", title) + "\n");
    this.deps.outputStream.write(
      this.format("dim", "─".repeat(title.length)) + "\n"
    );
  }

  public summary(title: string, stats: Record<string, any>): void {
    if (!this.shouldLog("info")) return;
    this.section(title);
    Object.entries(stats).forEach(([key, value]) => {
      this.deps.outputStream.write(
        this.format("gray", `${key.padStart(15)}: `) +
          this.format("bright", String(value)) +
          "\n"
      );
    });
  }

  public enableDebug(): void {
    this.debugEnabled = true;
  }

  public isDebugEnabled(): boolean {
    return this.debugEnabled;
  }
}
