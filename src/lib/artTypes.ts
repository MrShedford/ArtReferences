import type { SourceId } from '../types/artwork'

/**
 * Filtering the wall by what a thing *is* — a painting, a bronze, an etching —
 * rather than by what its catalogue text happens to mention.
 *
 * Searching the word "sculpture" doesn't do this: it matches paintings *of*
 * sculptures, exhibition catalogues, and anything whose description uses the
 * word. Every museum here exposes a real classification facet instead, so this
 * module maps one app-level type onto each museum's own vocabulary and the
 * adapters send it as a structured filter.
 *
 * The vocabularies genuinely disagree, and not in ways that can be derived —
 * they were found by probing each API live:
 *   - the Met wants plurals ("Paintings"), Cleveland wants singulars ("Painting")
 *   - AIC wants lowercase, and a `match` query rather than `term` (term returns 0)
 *   - Cleveland has no "Furniture" — the value is "Furniture and woodwork"
 *   - SMK is Danish, and being a fine-art gallery has essentially no
 *     decorative-arts holdings to filter
 *   - V&A's object types are granular ("Vase", "Chair"), so there is no
 *     umbrella "Ceramics" to ask for
 * Re-probe before adding a type; do not assume a value exists.
 */
export type ArtTypeId =
  | 'painting'
  | 'sculpture'
  | 'drawing'
  | 'print'
  | 'photograph'
  | 'textile'
  | 'ceramics'
  | 'furniture'
  | 'jewelry'
  | 'metalwork'

export const ART_TYPES: readonly { id: ArtTypeId; label: string }[] = [
  { id: 'painting', label: 'Paintings' },
  { id: 'sculpture', label: 'Sculpture' },
  { id: 'drawing', label: 'Drawings' },
  { id: 'print', label: 'Prints & etchings' },
  { id: 'photograph', label: 'Photographs' },
  { id: 'textile', label: 'Textiles' },
  { id: 'ceramics', label: 'Ceramics' },
  { id: 'furniture', label: 'Furniture' },
  { id: 'jewelry', label: 'Jewellery' },
  { id: 'metalwork', label: 'Metalwork' },
]

export const KNOWN_ART_TYPE_IDS: ReadonlySet<string> = new Set(ART_TYPES.map((t) => t.id))

export function isArtTypeId(value: string): value is ArtTypeId {
  return KNOWN_ART_TYPE_IDS.has(value)
}

type TypeTable = Record<ArtTypeId, string | null>

/**
 * `null` means "this museum has no facet value that cleanly expresses this
 * type" — the adapter then falls back to getTypeKeyword() and folds the word
 * into its free-text query instead. Approximate, but it keeps the museum on
 * the wall rather than silently dropping it.
 */
const FILTERS_BY_SOURCE: Partial<Record<SourceId, TypeTable>> = {
  // query[match][classification_title]= — every type verified non-empty.
  aic: {
    painting: 'painting',
    sculpture: 'sculpture',
    drawing: 'drawing',
    print: 'print',
    photograph: 'photograph',
    textile: 'textile',
    ceramics: 'ceramics',
    furniture: 'furniture',
    jewelry: 'jewelry',
    metalwork: 'metalwork',
  },

  // type= — echoed back as `classification_type`. Singular, except furniture.
  cleveland: {
    painting: 'Painting',
    sculpture: 'Sculpture',
    drawing: 'Drawing',
    print: 'Print',
    photograph: 'Photograph',
    textile: 'Textile',
    ceramics: 'Ceramic',
    // "Furniture" returns 0 here; this is the actual department name.
    furniture: 'Furniture and woodwork',
    jewelry: 'Jewelry',
    metalwork: 'Metalwork',
  },

  // medium= on /search — plurals, and the one source where all ten work.
  met: {
    painting: 'Paintings',
    sculpture: 'Sculpture',
    drawing: 'Drawings',
    print: 'Prints',
    photograph: 'Photographs',
    textile: 'Textiles',
    ceramics: 'Ceramics',
    furniture: 'Furniture',
    jewelry: 'Jewelry',
    metalwork: 'Metalwork',
  },

  // kw_object_type= — V&A records an object's *specific* type ("Vase",
  // "Chair", "Necklace"), so the fine-art types match cleanly and the
  // decorative ones have no umbrella term to ask for. Verified: "Ceramics"
  // and "Metalwork" both return 0, "Furniture" returns 11.
  vam: {
    painting: 'Painting',
    sculpture: 'Sculpture',
    drawing: 'Drawing',
    print: 'Print',
    photograph: 'Photograph',
    textile: 'Textile',
    ceramics: null,
    furniture: null,
    jewelry: null,
    metalwork: null,
  },

  // Folded into the Lucene q as `object_type:<value>` — no proxy change needed.
  smithsonian: {
    painting: 'Paintings',
    sculpture: 'Sculpture',
    drawing: 'Drawings',
    print: 'Prints',
    photograph: 'Photographs',
    textile: 'Textiles',
    ceramics: 'Ceramics',
    furniture: 'Furniture',
    jewelry: 'Jewelry',
    metalwork: 'Metalwork',
  },

  // classification= on /object. Untested against a live key — the local
  // HARVARD_API_KEY is empty — so treat these as the documented values rather
  // than verified ones, and check them the first time a key is present.
  harvard: {
    painting: 'Paintings',
    sculpture: 'Sculpture',
    drawing: 'Drawings',
    print: 'Prints',
    photograph: 'Photographs',
    textile: 'Textile Arts',
    ceramics: 'Vessels',
    furniture: 'Furniture',
    jewelry: 'Jewelry',
    metalwork: 'Metalwork',
  },

  // filters=[object_names:<value>] — Danish. SMK is a fine-art gallery: the
  // six decorative/photographic types return 0-19 records, which is worse
  // than a keyword search over the same collection.
  smk: {
    painting: 'maleri',
    sculpture: 'skulptur',
    drawing: 'tegning',
    print: 'grafik',
    photograph: null,
    textile: null,
    ceramics: null,
    furniture: null,
    jewelry: null,
    metalwork: null,
  },

  // qf=proxy_dc_type:<value>. Aggregated metadata across ~4000 institutions,
  // so coverage is uneven — "ceramics" and "metalwork" return 0 outright.
  europeana: {
    painting: 'painting',
    sculpture: 'sculpture',
    drawing: 'drawing',
    print: 'print',
    photograph: 'photograph',
    textile: 'textile',
    ceramics: null,
    furniture: 'furniture',
    jewelry: 'jewellery',
    metalwork: null,
  },

  // Linked Art `type=`, in Dutch, and it composes with creator= and title=
  // (creator=rembrandt&type=schilderij narrows 100 -> 24). An unrecognised
  // value returns zero results rather than silently unfiltered ones, so a
  // wrong entry here fails loudly — which is why "keramiek" is null: it
  // returns nothing, and Rijksmuseum only records granular ceramic types
  // ("vaas", "bord") with no umbrella term.
  rijksmuseum: {
    painting: 'schilderij',
    sculpture: 'beeldhouwwerk',
    drawing: 'tekening',
    print: 'prent',
    photograph: 'foto',
    textile: 'textiel',
    ceramics: null,
    furniture: 'meubilair',
    jewelry: 'sieraad',
    metalwork: 'metaal',
  },

  // wikimediaCommons deliberately has no entry: `incategory:` matches only one
  // flat category (105 hits for paintings) and `deepcategory:` walks the whole
  // subtree — accurate, but slow enough to trip the adapter's own timeout. It
  // takes the keyword path below.
}

/** English fallback words, used when a source has no facet for the type. */
const KEYWORDS: Record<ArtTypeId, string> = {
  painting: 'painting',
  sculpture: 'sculpture',
  drawing: 'drawing',
  print: 'print',
  photograph: 'photograph',
  textile: 'textile',
  ceramics: 'ceramic',
  furniture: 'furniture',
  jewelry: 'jewelry',
  metalwork: 'metalwork',
}

/**
 * Same reason browseTerms.ts keeps language pools: Rijksmuseum matches Dutch
 * titles and SMK Danish metadata, so an English keyword returns nothing at all
 * from either. Single words — Smithsonian and Europeana splice the query into
 * Lucene expressions where a phrase would parse as loose OR'd tokens.
 */
const KEYWORDS_BY_SOURCE: Partial<Record<SourceId, Record<ArtTypeId, string>>> = {
  rijksmuseum: {
    painting: 'schilderij',
    sculpture: 'beeldhouwwerk',
    drawing: 'tekening',
    print: 'prent',
    photograph: 'foto',
    textile: 'textiel',
    ceramics: 'keramiek',
    furniture: 'meubel',
    jewelry: 'sieraad',
    metalwork: 'metaal',
  },
  smk: {
    painting: 'maleri',
    sculpture: 'skulptur',
    drawing: 'tegning',
    print: 'grafik',
    photograph: 'fotografi',
    textile: 'tekstil',
    ceramics: 'keramik',
    furniture: 'møbel',
    jewelry: 'smykke',
    metalwork: 'metal',
  },
}

/**
 * The value this source should send in its own classification param, or null
 * when it has none — in which case the caller should use getTypeKeyword().
 */
export function getTypeFilter(sourceId: SourceId, type: ArtTypeId): string | null {
  return FILTERS_BY_SOURCE[sourceId]?.[type] ?? null
}

/** The word to fold into this source's free-text query, in its own language. */
export function getTypeKeyword(sourceId: SourceId, type: ArtTypeId): string {
  return KEYWORDS_BY_SOURCE[sourceId]?.[type] ?? KEYWORDS[type]
}

/**
 * Combines a user's query with a type for sources on the keyword path.
 * Browse mode passes an empty query, in which case the type word *is* the
 * query rather than a refinement of it.
 */
export function withTypeKeyword(
  sourceId: SourceId,
  query: string,
  type: ArtTypeId | undefined,
): string {
  if (!type) return query
  const keyword = getTypeKeyword(sourceId, type)
  const trimmed = query.trim()
  return trimmed ? `${trimmed} ${keyword}` : keyword
}
