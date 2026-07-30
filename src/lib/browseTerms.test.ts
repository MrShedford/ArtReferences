import test from 'node:test'
import assert from 'node:assert/strict'
import { getBrowseTerm } from './browseTerms.ts'
import { seededIndex } from './random.ts'

test('a source browses the same term for every page of one visit', () => {
  const seed = 12345
  assert.equal(getBrowseTerm('aic', seed), getBrowseTerm('aic', seed))
})

test('different seeds eventually pick different terms', () => {
  const terms = new Set(
    Array.from({ length: 200 }, (_, seed) => getBrowseTerm('aic', seed * 7919)),
  )
  assert.ok(terms.size > 1, 'browse terms never varied across seeds')
})

test('rijksmuseum and smk draw from their own language pools', () => {
  const dutch = new Set(
    Array.from({ length: 200 }, (_, seed) => getBrowseTerm('rijksmuseum', seed * 7919)),
  )
  const danish = new Set(
    Array.from({ length: 200 }, (_, seed) => getBrowseTerm('smk', seed * 7919)),
  )
  const english = new Set(
    Array.from({ length: 200 }, (_, seed) => getBrowseTerm('met', seed * 7919)),
  )

  // The pools are disjoint by construction; if one ever leaks an English term
  // into Rijksmuseum's title= search that source silently returns nothing.
  for (const term of dutch) assert.ok(!english.has(term), `"${term}" leaked into the Dutch pool`)
  for (const term of danish) assert.ok(!english.has(term), `"${term}" leaked into the Danish pool`)
})

test('browse terms stay single words for the Lucene-splicing adapters', () => {
  for (let seed = 0; seed < 200; seed++) {
    for (const id of ['aic', 'smithsonian', 'europeana', 'rijksmuseum', 'smk'] as const) {
      assert.doesNotMatch(getBrowseTerm(id, seed * 7919), /\s/)
    }
  }
})

test('seededIndex stays in range and varies with the seed', () => {
  const drawn = new Set<number>()
  for (let seed = 0; seed < 200; seed++) {
    const index = seededIndex('page:aic', seed * 7919, 8)
    assert.ok(index >= 0 && index < 8, `index ${index} out of range`)
    drawn.add(index)
  }
  assert.ok(drawn.size > 1, 'page offset never varied across seeds')
})
