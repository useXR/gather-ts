export interface ILogColors {
  reset: string;
  bright: string;
  dim: string;
  blue: string;
  green: string;
  yellow: string;
  red: string;
  gray: string;
}

export interface ILogger {
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
  section(title: string): void;
  summary(title: string, stats: Record<string, any>): void;
  enableDebug(): void;
  isDebugEnabled(): boolean;
}

export interface ILoggerConfig {
  enableDebug?: boolean;
  colors?: Partial<ILogColors>;
  timestamp?: boolean;
  logLevel?: LogLevel;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ILogMessage {
  level: LogLevel;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}