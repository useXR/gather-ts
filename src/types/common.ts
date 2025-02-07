// Basic utility types used throughout the application
export type Optional<T> = T | undefined;
export type Nullable<T> = T | null;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Common operation types
export type Operation = "read" | "write" | "create" | "delete" | "update";

// Common result types
export interface IResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Common metadata types
export interface IMetadata {
  createdAt: string;
  updatedAt: string;
  version: string;
}
