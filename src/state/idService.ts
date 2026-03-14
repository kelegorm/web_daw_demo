/**
 * idService.ts — Encapsulated ID generation with uniqueness guarantee.
 *
 * Maintains a Set of used IDs so generated IDs are never reused, even after
 * removal. Supports seeding with pre-existing IDs (e.g., from loaded project).
 */

export interface IdService {
  /**
   * Register pre-existing IDs into the used set so they are never generated.
   * Can be called multiple times — each call is additive.
   */
  seed(ids: string[]): void;

  /**
   * Generate a unique ID string that has never been returned before.
   * Uses an incrementing counter prefixed with "track-".
   * Skips any IDs already in the used set (seeded or previously generated).
   */
  generate(): string;
}

/**
 * Factory function that creates a fresh IdService instance.
 * Each call returns an independent service with its own state.
 */
export function createIdService(): IdService {
  const used = new Set<string>();
  let counter = 1;

  return {
    seed(ids: string[]): void {
      for (const id of ids) {
        used.add(id);
      }
    },

    generate(): string {
      let candidate: string;
      do {
        candidate = `track-${counter}`;
        counter += 1;
      } while (used.has(candidate));

      used.add(candidate);
      return candidate;
    },
  };
}
