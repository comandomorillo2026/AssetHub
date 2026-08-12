import { NextRequest, NextResponse } from 'next/server'
import { hashPassword, comparePassword, signSuperAdminToken } from '@/lib/jwt'

// Public endpoint for super admin login (whitelisted in middleware)
// Auto-creates the super admin on first login if none exists (bootstrap)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const { db } = await import('@/lib/db')

    // Bootstrap: if no super admin exists, create one with provided credentials
    const adminCount = await db.superAdmin.count()
    if (adminCount === 0) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'No admin account exists. Contact system administrator.' }, { status: 403 })
      }
      const newAdmin = await db.superAdmin.create({
        data: {
          email,
          passwordHash: hashPassword(password),
          name: 'Super Administrator',
          isActive: true,
        },
      })
      const token = signSuperAdminToken({ adminId: newAdmin.id, email: newAdmin.email })
      return NextResponse.json({
        user: { id: newAdmin.id, email: newAdmin.email, name: newAdmin.name, isActive: newAdmin.isActive },
        accessToken: token,
        bootstrapped: true,
      })
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
