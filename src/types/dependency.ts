/**
 * Represents a map of file dependencies where each key is a file path
 * and the value is an array of paths to its dependencies
 */
export interface IDependencyMap {
  [key: string]: string[];
}
