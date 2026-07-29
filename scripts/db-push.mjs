/**
 * Applies db/schema.sql to the database in DATABASE_URL.
 *
 * Plain .mjs, and deliberately in neither tsconfig's `include`, so `tsc -b`
 * never sees it and this stays a script rather than part of the build.
 *
 *   npm run db:push
 *
 * The schema is idempotent, so re-running is a no-op. If you'd rather not run
 * it locally at all, paste db/schema.sql into the Neon SQL Editor instead.
 */

import { readFile } from 'node:fs/promises'
import { neon } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL
if (!url) {
  console.error(
    'DATABASE_URL is not set.\n' +
      'Add it to .env (see .env.example), or paste db/schema.sql into the Neon SQL Editor.',
  )
  process.exit(1)
}

const text = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')

// Strip comments first: a `--` line containing a semicolon would otherwise
// split a statement in half.
const statements = text
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter((statement) => statement.length > 0)

const sql = neon(url)

// The HTTP driver sends one statement per request; transaction() batches them
// into a single round trip that either all applies or none does.
await sql.transaction(statements.map((statement) => sql.query(statement)))

console.log(`Applied ${statements.length} statements from db/schema.sql.`)
