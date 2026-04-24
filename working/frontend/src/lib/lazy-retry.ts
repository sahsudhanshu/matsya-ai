/**
 * Wraps React.lazy imports with automatic retry logic.
 *
 * In Next.js + Turbopack dev mode, lazy chunks are compiled on-demand.
 * If the browser requests a chunk before Turbopack finishes compiling it,
 * the server returns 404 and React.lazy permanently marks the import as
 * failed (ChunkLoadError). This helper retries the import once after a
 * short delay, giving Turbopack time to finish compiling.
 */
export function lazyRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retryDelay = 1500,
  retries = 2,
): () => Promise<{ default: T }> {
  return () =>
    factory().catch((err: unknown) => {
      const isChunkError =
        err instanceof Error &&
        (err.name === "ChunkLoadError" ||
          err.message.includes("Loading chunk") ||
          err.message.includes("Failed to fetch dynamically imported module"));

      if (retries > 0 && isChunkError) {
        return new Promise<{ default: T }>((resolve, reject) => {
          setTimeout(() => {
            lazyRetry(factory, retryDelay, retries - 1)()
              .then(resolve)
              .catch(reject);
          }, retryDelay);
        });
      }
      throw err;
    });
}
