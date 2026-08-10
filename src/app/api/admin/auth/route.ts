import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
import { createHash } from 'crypto'

function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'zeitgeist-salt-2024').digest('hex')
}

function verifyAdmin(req: NextRequest): boolean {
  return req.headers.get('x-super-admin-token') === 'zeitgeist-super-admin-2024'
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const passwordHash = hashPassword(password)

    const admin = await db.superAdmin.findUnique({
      where: { email },
    })

    if (!admin || admin.passwordHash !== passwordHash) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    if (!admin.isActive) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 })
    }

    // Update last login
    await db.superAdmin.update({
      where: { id: admin.id },
      data: { lastLogin: new Date() },
    })

    // Generate a simple token (in production, use JWT)
    const token = createHash('sha256')
      .update(admin.id + admin.email + Date.now().toString())
      .digest('hex')

    return NextResponse.json({
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        isActive: admin.isActive,
      },
      token,
    })
  } catch (error) {
    console.error('Admin auth error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
