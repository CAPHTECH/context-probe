import type { ProgressUpdate } from "./contracts.js";

export type ProgressReporter = (update: ProgressUpdate) => void;

export interface ProgressTracker {
  progress: ProgressUpdate[];
  reportProgress: ProgressReporter;
  withProgress<T>(phase: string, message: string, task: () => Promise<T> | T): Promise<T>;
}

function formatElapsedMs(elapsedMs: number): string {
  if (elapsedMs < 1000) {
    return `${elapsedMs}ms`;
  }
  return `${Math.round(elapsedMs / 1000)}s`;
}

export function createProgressTracker(reporter?: ProgressReporter): ProgressTracker {
  const progress: ProgressUpdate[] = [];

  const reportProgress: ProgressReporter = (update) => {
    progress.push(update);
    reporter?.(update);
  };

  return {
    progress,
    reportProgress,
    async withProgress<T>(phase: string, message: string, task: () => Promise<T> | T): Promise<T> {
      const startedAt = Date.now();
      reportProgress({ phase, message });
      try {
        const result = await task();
        const elapsedMs = Date.now() - startedAt;
        reportProgress({
          phase,
          message: `${message} completed in ${formatElapsedMs(elapsedMs)}.`,
          elapsedMs,
        });
        return result;
      } catch (error) {
        const elapsedMs = Date.now() - startedAt;
        reportProgress({
          phase,
          message: `${message} failed after ${formatElapsedMs(elapsedMs)}.`,
          elapsedMs,
        });
        throw error;
      }
    },
  };
}
