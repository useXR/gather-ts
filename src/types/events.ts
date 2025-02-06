// src/types/events.ts

import { ICLIOptions, ICLIResult } from "@/interfaces/cli";

/**
 * CLI event map
 */
export interface ICLIEventMap {
    /** Command start event */
    'command:start': {
      command: string;
      options: ICLIOptions;
      timestamp: number;
    };
    /** Command complete event */
    'command:complete': {
      command: string;
      result: ICLIResult;
      timestamp: number;
    };
    /** Error event */
    'error': {
      error: Error;
      command?: string;
      timestamp: number;
    };
    /** Warning event */
    'warning': {
      message: string;
      command?: string;
      timestamp: number;
    };
    /** Progress event */
    'progress': {
      phase: string;
      completed: number;
      total: number;
      message?: string;
    };
  }
  
  /**
   * CLI event emitter interface
   */
  export interface ICLIEventEmitter {
    on<K extends keyof ICLIEventMap>(
      event: K,
      listener: (data: ICLIEventMap[K]) => void
    ): void;
    
    off<K extends keyof ICLIEventMap>(
      event: K,
      listener: (data: ICLIEventMap[K]) => void
    ): void;
    
    emit<K extends keyof ICLIEventMap>(
      event: K,
      data: ICLIEventMap[K]
    ): void;
  }