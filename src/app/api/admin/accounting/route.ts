import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

function verifyAdmin(req: NextRequest): boolean {
  return req.headers.get('x-super-admin-token') === 'zeitgeist-super-admin-2024'
}

// GET /api/admin/accounting - Ledger accounts, journal entries, trial balance
export async function GET(req: NextRequest) {
  try {
    if (!verifyAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const type = url.searchParams.get('type') || 'all'

    if (type === 'trial_balance') {
      // Get all ledger accounts with their debit/credit totals
      const accounts = await db.ledgerAccount.findMany({
        where: { isActive: true },
        include: {
          entries: {
            include: {
              journalEntry: {
                select: { status: true },
              },
            },
          },
        },
        orderBy: { code: 'asc' },
      })

      const trialBalance = accounts.map(account => {
        const postedEntries = account.entries.filter(e => e.journalEntry.status === 'posted')
        const totalDebit = postedEntries.reduce((sum, e) => sum + e.debit, 0)
        const totalCredit = postedEntries.reduce((sum, e) => sum + e.credit, 0)
        const balance = totalDebit - totalCredit

        return {
          id: account.id,
          code: account.code,
          name: account.name,
          accountType: account.accountType,
          totalDebit,
          totalCredit,
          balance,
          debitBalance: balance > 0 ? balance : 0,
          creditBalance: balance < 0 ? Math.abs(balance) : 0,
        }
      })

      const totalDebits = trialBalance.reduce((sum, a) => sum + a.totalDebit, 0)
      const totalCredits = trialBalance.reduce((sum, a) => sum + a.totalCredit, 0)

      return NextResponse.json({
        trialBalance,
        totalDebits,
        totalCredits,
        balanced: Math.abs(totalDebits - totalCredits) < 0.01,
      })
    }

    // Default: return accounts + journal entries
    const [accounts, journalEntries] = await Promise.all([
      db.ledgerAccount.findMany({
        orderBy: { code: 'asc' },
      }),
      db.journalEntry.findMany({
        orderBy: { date: 'desc' },
        take: 50,
        include: {
          entries: {
            include: {
              ledgerAccount: {
                select: { code: true, name: true },
              },
            },
          },
        },
      }),
    ])

    return NextResponse.json({ accounts, journalEntries })
  } catch (error) {
    console.error('Accounting error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/accounting - Create journal entry
export async function POST(req: NextRequest) {
  try {
    if (!verifyAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { description, date, entries, status, tenantId } = body

    if (!description || !entries || !entries.length) {
      return NextResponse.json({ error: 'Description and entries are required' }, { status: 400 })
    }

    // Validate debits = credits
    const totalDebit = entries.reduce((sum: number, e: { debit: number }) => sum + e.debit, 0)
    const totalCredit = entries.reduce((sum: number, e: { credit: number }) => sum + e.credit, 0)

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json(
        { error: `Entry must balance. Debits: ${totalDebit}, Credits: ${totalCredit}` },
        { status: 400 }
      )
    }

    // Generate journal entry number
    const count = await db.journalEntry.count()
    const year = new Date().getFullYear()
    const number = `JE-${year}-${String(count + 1).padStart(4, '0')}`

    const journalEntry = await db.journalEntry.create({
      data: {
        number,
        description,
        date: new Date(date || Date.now()),
        status: status || 'draft',
        tenantId,
        entries: {
          create: entries.map((e: { ledgerAccountId: string; debit: number; credit: number; description?: string }) => ({
            ledgerAccountId: e.ledgerAccountId,
            debit: e.debit || 0,
            credit: e.credit || 0,
            description: e.description,
          })),
        },
      },
      include: {
        entries: {
          include: {
            ledgerAccount: true,
          },
        },
      },
    })

    return NextResponse.json({ journalEntry }, { status: 201 })
  } catch (error) {
    console.error('Create journal entry error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
