import test from 'node:test'
import assert from 'node:assert/strict'
import { createSeededRng, hashSeed, shuffleWithRng } from './random.ts'

test('seeded helpers stay deterministic for the same seed', () => {
  const firstRng = createSeededRng(hashSeed('browse-seed'))
  const secondRng = createSeededRng(hashSeed('browse-seed'))

  const firstValues = Array.from({ length: 8 }, () => firstRng())
  const secondValues = Array.from({ length: 8 }, () => secondRng())

  assert.deepEqual(firstValues, secondValues)

  const items = ['a', 'b', 'c', 'd', 'e']
  // Both shuffles need an RNG at the same state — firstRng has already been
  // advanced eight times above, so it can't be one of them.
  const ordered = shuffleWithRng(items, createSeededRng(hashSeed('browse-seed')))
  const sameSeedOrdered = shuffleWithRng(items, createSeededRng(hashSeed('browse-seed')))

  assert.equal(ordered.length, items.length)
  assert.deepEqual(ordered.slice().sort(), items.slice().sort())
  assert.deepEqual(ordered, sameSeedOrdered)
})

test('a different seed produces a different order', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  const ordered = shuffleWithRng(items, createSeededRng(hashSeed('seed-one')))
  const otherOrdered = shuffleWithRng(items, createSeededRng(hashSeed('seed-two')))

  assert.notDeepEqual(ordered, otherOrdered)
})
