import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
import { hashPassword, comparePassword, signSuperAdminToken } from '@/lib/jwt'

// This is a public endpoint for super admin login (whitelisted in middleware)
// But we still verify credentials properly
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const admin = await db.superAdmin.findUnique({ where: { email } })

    if (!admin || !comparePassword(password, admin.passwordHash)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    if (!admin.isActive) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 })
    }

    await db.superAdmin.update({
      where: { id: admin.id },
      data: { lastLogin: new Date() },
    })

    const token = signSuperAdminToken({ adminId: admin.id, email: admin.email })

    return NextResponse.json({
      user: { id: admin.id, email: admin.email, name: admin.name, isActive: admin.isActive },
      accessToken: token,
    })
  } catch (error) {
    console.error('Admin auth error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
