import type { SourceId } from '../types/artwork'
import type { MuseumSource } from './types'
import { aicSource } from './aic'
import { clevelandSource } from './cleveland'
import { vamSource } from './vam'
import { metSource } from './met'
import { rijksmuseumSource } from './rijksmuseum'
import { harvardSource } from './harvard'
import { smithsonianSource } from './smithsonian'
import { smkSource } from './smk'
import { europeanaSource } from './europeana'
import { wikimediaCommonsSource } from './wikimediaCommons'

export type { MuseumSource } from './types'

/**
 * Every museum the wall knows about. Adding a new museum is: write an
 * adapter module satisfying MuseumSource, then add it here — nothing else
 * in the app needs to change.
 */
export const allSources: MuseumSource[] = [
  aicSource,
  clevelandSource,
  vamSource,
  metSource,
  rijksmuseumSource,
  harvardSource,
  smithsonianSource,
  smkSource,
  europeanaSource,
  wikimediaCommonsSource,
]

/**
 * Keyless sources always work. Key-gated ones depend on whether the server
 * has that key, which the client learns from /api/config — it can't check
 * itself, since the keys deliberately never reach the browser.
 */
export const isSourceAvailable = (source: MuseumSource, configuredIds: Set<SourceId>) =>
  !source.requiresKey || configuredIds.has(source.id)
