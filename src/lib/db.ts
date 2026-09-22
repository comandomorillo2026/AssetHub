import { PrismaClient } from '@prisma/client'

/**
 * QA fix (2026-09-22): production hit Postgres error 42P05
 * "prepared statement \"s…\" already exists" on every DB route after the
 * connection pool started reusing server connections. That is the classic
 * symptom of Prisma's prepared statements colliding with a transaction-mode
 * pooler (Supabase Supavisor / PgBouncer) sitting in front of the database.
 *
 * Fix without requiring an env-var change: append `pgbouncer=true` to the
 * datasource URL at client construction time. Prisma then switches to simple
 * query protocol (no prepared statements), which is safe behind transaction
 * pooling. The append is idempotent and preserves existing query params.
 *
 * If the URL already contains pgbouncer= this is a no-op.
 */
function withPgBouncer(url: string | undefined): string | undefined {
  if (!url) return url
  if (url.includes('pgbouncer=')) return url
  return url + (url.includes('?') ? '&' : '?') + 'pgbouncer=true'
}

const datasourceUrl = withPgBouncer(process.env.DATABASE_URL)

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
