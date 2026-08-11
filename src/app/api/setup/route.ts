import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import path from 'path'

// This endpoint creates all database tables on first deploy
// Call it ONCE after setting DATABASE_URL in Vercel env vars
// GET /api/setup?secret=assethub-setup-2026
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (secret !== 'assethub-setup-2026') {
    return NextResponse.json({ error: 'Invalid setup secret' }, { status: 403 })
  }

  try {
    const prismaPath = path.join(process.cwd(), 'node_modules', '.bin', 'prisma')
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')

    const result = execSync(
      `"${prismaPath}" db push --accept-data-loss --schema="${schemaPath}"`,
      { encoding: 'utf-8', timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
    )

    return NextResponse.json({
      success: true,
      message: 'Database tables created successfully',
      output: result,
    })
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string }
    return NextResponse.json({
      success: false,
      error: 'Failed to create tables',
      details: err.stderr || err.message,
    }, { status: 500 })
  }
}

// POST /api/setup/seed - Create super admin + demo plans
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (secret !== 'assethub-setup-2026') {
    return NextResponse.json({ error: 'Invalid setup secret' }, { status: 403 })
  }

  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    const response = await fetch(`${baseUrl}/api/admin/quick-seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Seed failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
