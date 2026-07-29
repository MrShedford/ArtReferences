/**
 * Minimal concurrency limiter. The Met and Rijksmuseum adapters both do
 * search-then-fetch-each-detail fanouts; without a cap the browser's
 * per-host connection limit makes the whole page stall on one slow museum.
 */
export function pLimit(concurrency: number) {
  let active = 0
  const queue: Array<() => void> = []

  const next = () => {
    active--
    if (queue.length > 0) {
      const run = queue.shift()!
      run()
    }
  }

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const run = () => {
        active++
        fn().then(
          (value) => {
            next()
            resolve(value)
          },
          (err) => {
            next()
            reject(err)
          },
        )
      }

      if (active < concurrency) {
        run()
      } else {
        queue.push(run)
      }
    })
  }
}
