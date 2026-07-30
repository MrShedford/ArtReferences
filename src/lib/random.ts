/**
 * Seeded helpers, all deterministic given a seed. The browse seed itself lives
 * in useBrowseSeed, which owns when it's allowed to change.
 *
 * Determinism is the point: distributeIntoColumns only leaves already-placed
 * cards alone because the artwork list is append-only (see its doc comment), so
 * a bare Math.random() in the query path would re-roll on every refetch and
 * make cards hop between columns mid-scroll.
 */

export function hashSeed(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A stable integer in [0, max) for a given key+seed pair. Lets each museum draw
 * its own browse term and its own starting depth from the one session seed,
 * without threading a separate RNG instance per source.
 */
export function seededIndex(key: string, seed: number, max: number): number {
  return hashSeed(`${seed}:${key}`) % max
}

export function shuffleWithRng<T>(values: readonly T[], rng: () => number): T[] {
  const copy = [...values]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
