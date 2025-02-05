import { ILogger, ILoggerConfig, ILogColors } from './interfaces/ILogger';

export class Logger implements ILogger {
  private static instance: Logger;
  private debugEnabled: boolean = false;
  private readonly colors: ILogColors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    blue: "\x1b[34m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    gray: "\x1b[90m"
  };

  private constructor(config?: ILoggerConfig) {
    if (config?.enableDebug) {
      this.debugEnabled = true;
    }
    if (config?.colors) {
      this.colors = { ...this.colors, ...config.colors };
    }
  }

  public static getInstance(config?: ILoggerConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  private format(color: keyof ILogColors, message: string): string {
    return `${this.colors[color]}${message}${this.colors.reset}`;
  }

  public info(message: string): void {
    console.log(this.format('blue', 'ℹ'), message);
  }

  public success(message: string): void {
    console.log(this.format('green', '✓'), message);
  }

  public warn(message: string): void {
    console.log(this.format('yellow', '⚠'), message);
  }

  public error(message: string): void {
    console.log(this.format('red', '✖'), message);
  }

  public debug(message: string): void {
    if (this.debugEnabled) {
      console.log(this.format('gray', '→'), message);
    }
  }

  public section(title: string): void {
    console.log('\n' + this.format('bright', title));
    console.log(this.format('dim', '─'.repeat(title.length)));
  }

  public summary(title: string, stats: Record<string, any>): void {
    this.section(title);
    Object.entries(stats).forEach(([key, value]) => {
      console.log(
        this.format('gray', `${key.padStart(15)}: `) + 
        this.format('bright', String(value))
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

// Export a default instance
export const logger = Logger.getInstance();