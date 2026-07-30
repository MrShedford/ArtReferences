import type { SourceId } from '../types/artwork'
// Extension-qualified so `node --test` can resolve this module when it runs the
// sibling .test.ts directly; Vite is happy either way.
import { seededIndex } from './random.ts'

/**
 * What the wall shows when nobody has typed a search yet.
 *
 * Every adapter hardcodes a single fallback term ('painting' for most, 'art'
 * for the Met), which is the main reason the landing page looked identical on
 * every visit. Drawing a term per visit changes what the wall is *about*, not
 * just how deep into the results it starts.
 *
 * Terms are deliberately single words: Smithsonian and Europeana splice the
 * query into Lucene-style expressions ("<q> AND online_media_type:Images"),
 * where a multi-word term would parse as two loosely OR'd tokens rather than a
 * phrase.
 */
const DEFAULT_POOL = [
  'painting',
  'portrait',
  'landscape',
  'sculpture',
  'drawing',
  'watercolor',
  'engraving',
  'ceramic',
  'textile',
  'photograph',
  'bronze',
  'woodcut',
]

/**
 * Rijksmuseum matches against Dutch object titles and SMK against Danish
 * metadata, so an English term returns close to nothing from either — which is
 * why their adapters hardcode 'landschap' and 'maleri' today.
 */
const POOLS_BY_SOURCE: Partial<Record<SourceId, string[]>> = {
  rijksmuseum: [
    'landschap',
    'portret',
    'stilleven',
    'zelfportret',
    'gezicht',
    'bloemen',
    'schip',
    'molen',
  ],
  smk: ['maleri', 'portræt', 'landskab', 'skulptur', 'tegning', 'akvarel', 'blomster'],
}

/**
 * Subjects only — no medium words. When an art-type filter is active the
 * browse term must not name a competing medium: drawing a term of 'sculpture'
 * while the filter asks for paintings searches for paintings *of* sculptures,
 * and the wall comes back nearly empty. What a piece depicts is orthogonal to
 * what it is, so these stay free to vary.
 */
const DEFAULT_SUBJECT_POOL = [
  'portrait',
  'landscape',
  'seascape',
  'flowers',
  'garden',
  'river',
  'mountain',
  'horse',
  'harbour',
  'figure',
]

const SUBJECT_POOLS_BY_SOURCE: Partial<Record<SourceId, string[]>> = {
  rijksmuseum: ['landschap', 'portret', 'gezicht', 'bloemen', 'schip', 'molen'],
  smk: ['portræt', 'landskab', 'blomster'],
}

/**
 * Stable for a given source+seed pair, so every page fetched during one visit
 * keeps browsing the same term — otherwise page 2 would be a different subject
 * than page 1 and the wall would read as noise.
 */
export function getBrowseTerm(sourceId: SourceId, seed: number): string {
  const pool = POOLS_BY_SOURCE[sourceId] ?? DEFAULT_POOL
  return pool[seededIndex(`term:${sourceId}`, seed, pool.length)]
}

/**
 * The browse term to use when an art-type filter is active. Same stability
 * guarantee as getBrowseTerm, drawn from the subject-only pools so the term
 * refines the filter instead of contradicting it.
 */
export function getBrowseSubject(sourceId: SourceId, seed: number): string {
  const pool = SUBJECT_POOLS_BY_SOURCE[sourceId] ?? DEFAULT_SUBJECT_POOL
  return pool[seededIndex(`subject:${sourceId}`, seed, pool.length)]
}
