export type SourceId =
  | 'aic'
  | 'cleveland'
  | 'vam'
  | 'met'
  | 'rijksmuseum'
  | 'harvard'
  | 'smithsonian'
  | 'smk'
  | 'europeana'
  | 'wikimediaCommons'

/**
 * The single shape every museum adapter must normalize its results into.
 * The UI only ever renders this type — it never needs to know which museum
 * a card came from beyond the label/id used for display and filtering.
 */
export interface Artwork {
  /** `${sourceId}:${originalId}` — stable, collision-free React key across merged sources. */
  uid: string
  sourceId: SourceId
  sourceLabel: string
  title: string
  artist?: string
  date?: string
  medium?: string
  department?: string
  /** Image used on the wall. Adapters must guarantee this is non-empty. */
  thumbUrl: string
  /** Higher-resolution image used in the lightbox, falls back to thumbUrl. */
  fullUrl?: string
  /** Original pixel dimensions, when known — used to reserve wall layout space. */
  width?: number
  height?: number
  /** Base64 low-quality placeholder (AIC only) for a blur-up loading effect. */
  blurDataUrl?: string
  alt?: string
  creditLine?: string
  /** Link back to the artwork's page on the museum's own site. */
  objectUrl?: string
  isPublicDomain?: boolean
}
