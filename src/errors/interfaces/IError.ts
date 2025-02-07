// src/errors/interfaces/IError.ts

import { IErrorDetails } from "@/types/errors";


export interface IErrorClassification {
  type: string;
  severity: "error" | "warning" | "info";
  message: string;
  details?: IErrorDetails;
  stackTrace?: string;
}

export interface IErrorTransformation {
  condition: (error: Error) => boolean;
  transform: (error: Error) => Error;
}

export interface IErrorMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  totalWarnings: number;
  startTime: number;
  lastErrorTime?: number;
}
