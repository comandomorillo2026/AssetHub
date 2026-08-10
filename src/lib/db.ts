import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Force fresh client if schema changed
if (globalForPrisma.prisma) {
  try {
    // Test if client has the new models
    const _test = globalForPrisma.prisma.ledgerAccount
    if (!_test) {
      globalForPrisma.prisma = undefined
    }
  } catch {
    globalForPrisma.prisma = undefined
  }
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
