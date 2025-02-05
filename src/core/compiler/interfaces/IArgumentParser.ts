import { ICompileOptions } from '@/types/compiler';

export interface IArgumentParser {
  parseArguments(args: string[]): ICompileOptions;
}