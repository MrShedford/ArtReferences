import test from 'node:test'
import assert from 'node:assert/strict'
import { ART_TYPES, getTypeFilter, getTypeKeyword, isArtTypeId, withTypeKeyword } from './artTypes.ts'
import type { ArtTypeId } from './artTypes.ts'
import type { SourceId } from '../types/artwork'

const ALL_SOURCE_IDS: SourceId[] = [
  'aic',
  'cleveland',
  'vam',
  'met',
  'rijksmuseum',
  'harvard',
  'smithsonian',
  'smk',
  'europeana',
  'wikimediaCommons',
]

const ALL_TYPE_IDS = ART_TYPES.map((t) => t.id)

test('every source resolves a keyword for every type', () => {
  for (const sourceId of ALL_SOURCE_IDS) {
    for (const type of ALL_TYPE_IDS) {
      const keyword = getTypeKeyword(sourceId, type)
      assert.ok(keyword.length > 0, `${sourceId}/${type} produced an empty keyword`)
    }
  }
})

test('keywords stay single words for the Lucene-splicing adapters', () => {
  // Smithsonian and Europeana splice the query into "<q> AND field:value"
  // expressions, where a two-word keyword parses as loose OR'd tokens.
  for (const sourceId of ['aic', 'smithsonian', 'europeana', 'rijksmuseum', 'smk'] as const) {
    for (const type of ALL_TYPE_IDS) {
      assert.doesNotMatch(getTypeKeyword(sourceId, type), /\s/, `${sourceId}/${type} is multi-word`)
    }
  }
})

test('getTypeFilter returns null rather than throwing for unmapped sources', () => {
  // Commons is deliberately absent from the filter table.
  for (const type of ALL_TYPE_IDS) {
    assert.equal(getTypeFilter('wikimediaCommons', type), null)
  }
})

test('rijksmuseum filter values stay Dutch', () => {
  // An unrecognised type= returns zero results from Rijksmuseum rather than
  // unfiltered ones, so an English value here would empty the source silently.
  assert.equal(getTypeFilter('rijksmuseum', 'painting'), 'schilderij')
  assert.equal(getTypeFilter('rijksmuseum', 'print'), 'prent')
  // Only granular ceramic types exist there ("vaas", "bord"), no umbrella.
  assert.equal(getTypeFilter('rijksmuseum', 'ceramics'), null)
})

test('sources on the keyword path use their own language', () => {
  // An English keyword against Rijksmuseum's Dutch titles or SMK's Danish
  // metadata returns nothing, which would read as a broken filter.
  assert.equal(getTypeKeyword('rijksmuseum', 'painting'), 'schilderij')
  assert.equal(getTypeKeyword('smk', 'ceramics'), 'keramik')
  assert.equal(getTypeKeyword('met', 'painting'), 'painting')
})

test('every mapped filter value is a non-empty string', () => {
  for (const sourceId of ALL_SOURCE_IDS) {
    for (const type of ALL_TYPE_IDS) {
      const value = getTypeFilter(sourceId, type)
      if (value !== null) assert.ok(value.length > 0, `${sourceId}/${type} mapped to empty string`)
    }
  }
})

test('withTypeKeyword refines a query but replaces an empty one', () => {
  assert.equal(withTypeKeyword('met', 'vermeer', 'painting'), 'vermeer painting')
  // Browse mode: the type word becomes the query rather than refining nothing.
  assert.equal(withTypeKeyword('met', '', 'sculpture'), 'sculpture')
  assert.equal(withTypeKeyword('met', '   ', 'sculpture'), 'sculpture')
  // No type selected leaves the query untouched.
  assert.equal(withTypeKeyword('met', 'vermeer', undefined), 'vermeer')
})

test('isArtTypeId accepts every listed id and rejects junk', () => {
  for (const type of ALL_TYPE_IDS) assert.ok(isArtTypeId(type))
  assert.ok(!isArtTypeId('paintings'))
  assert.ok(!isArtTypeId(''))
})

test('type labels are unique and non-empty', () => {
  const labels = new Set(ART_TYPES.map((t) => t.label))
  assert.equal(labels.size, ART_TYPES.length, 'duplicate label in ART_TYPES')
  const ids = new Set<ArtTypeId>(ALL_TYPE_IDS)
  assert.equal(ids.size, ART_TYPES.length, 'duplicate id in ART_TYPES')
})
