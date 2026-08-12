import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-helpers';

const DEFAULT_TYPES = 'assets,users,locations,categories,maintenance,work_orders';
const PER_TYPE_LIMIT = 10;

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (auth instanceof NextResponse) return auth;

    const { tenantId } = auth;

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';

    if (q.length < 2) {
      return NextResponse.json({
        results: {},
        total: 0,
      });
    }

    const typesParam = searchParams.get('types') || DEFAULT_TYPES;
    const types = new Set(typesParam.split(',').map((t) => t.trim()).filter(Boolean));

    const results: Record<string, unknown[]> = {};
    let total = 0;

    const queries: Promise<void>[] = [];

    if (types.has('assets')) {
      queries.push(
        db.asset
          .findMany({
            where: {
              tenantId,
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { tagNumber: { contains: q, mode: 'insensitive' as const } },
                { serialNumber: { contains: q, mode: 'insensitive' as const } },
                { brand: { contains: q, mode: 'insensitive' as const } },
                { model: { contains: q, mode: 'insensitive' as const } },
              ],
            },
            select: {
              id: true,
              name: true,
              tagNumber: true,
              serialNumber: true,
              brand: true,
              model: true,
              status: true,
            },
            take: PER_TYPE_LIMIT,
          })
          .then((items) => {
            results.assets = items.map((a) => ({
              id: a.id,
              type: 'asset',
              title: a.name,
              subtitle: [a.tagNumber, a.brand, a.model].filter(Boolean).join(' · ') || a.status,
              status: a.status,
            }));
            total += items.length;
          }),
      );
    }

    if (types.has('users')) {
      queries.push(
        db.user
          .findMany({
            where: {
              tenantId,
              isActive: true,
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { email: { contains: q, mode: 'insensitive' as const } },
                { department: { contains: q, mode: 'insensitive' as const } },
                { jobTitle: { contains: q, mode: 'insensitive' as const } },
              ],
            },
            select: {
              id: true,
              name: true,
              email: true,
              department: true,
              jobTitle: true,
              role: true,
            },
            take: PER_TYPE_LIMIT,
          })
          .then((items) => {
            results.users = items.map((u) => ({
              id: u.id,
              type: 'user',
              title: u.name,
              subtitle: [u.email, u.department, u.jobTitle].filter(Boolean).join(' · ') || u.role,
              role: u.role,
            }));
            total += items.length;
          }),
      );
    }

    if (types.has('locations')) {
      queries.push(
        db.location
          .findMany({
            where: {
              tenantId,
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { code: { contains: q, mode: 'insensitive' as const } },
                { address: { contains: q, mode: 'insensitive' as const } },
              ],
            },
            select: {
              id: true,
              name: true,
              code: true,
              address: true,
            },
            take: PER_TYPE_LIMIT,
          })
          .then((items) => {
            results.locations = items.map((l) => ({
              id: l.id,
              type: 'location',
              title: l.name,
              subtitle: [l.code, l.address].filter(Boolean).join(' · '),
            }));
            total += items.length;
          }),
      );
    }

    if (types.has('categories')) {
      queries.push(
        db.category
          .findMany({
            where: {
              tenantId,
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { code: { contains: q, mode: 'insensitive' as const } },
              ],
            },
            select: {
              id: true,
              name: true,
              code: true,
              color: true,
              icon: true,
            },
            take: PER_TYPE_LIMIT,
          })
          .then((items) => {
            results.categories = items.map((c) => ({
              id: c.id,
              type: 'category',
              title: c.name,
              subtitle: c.code,
              color: c.color,
              icon: c.icon,
            }));
            total += items.length;
          }),
      );
    }

    if (types.has('maintenance')) {
      queries.push(
        db.maintenance
          .findMany({
            where: {
              tenantId,
              OR: [
                { title: { contains: q, mode: 'insensitive' as const } },
                { description: { contains: q, mode: 'insensitive' as const } },
                { vendor: { contains: q, mode: 'insensitive' as const } },
              ],
            },
            select: {
              id: true,
              title: true,
              description: true,
              vendor: true,
              status: true,
              type: true,
            },
            take: PER_TYPE_LIMIT,
          })
          .then((items) => {
            results.maintenance = items.map((m) => ({
              id: m.id,
              type: 'maintenance',
              title: m.title,
              subtitle: [m.type, m.status, m.vendor].filter(Boolean).join(' · '),
              status: m.status,
            }));
            total += items.length;
          }),
      );
    }

    if (types.has('work_orders')) {
      queries.push(
        db.workOrder
          .findMany({
            where: {
              tenantId,
              OR: [
                { title: { contains: q, mode: 'insensitive' as const } },
                { description: { contains: q, mode: 'insensitive' as const } },
              ],
            },
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              priority: true,
            },
            take: PER_TYPE_LIMIT,
          })
          .then((items) => {
            results.work_orders = items.map((w) => ({
              id: w.id,
              type: 'work_order',
              title: w.title,
              subtitle: [w.priority, w.status].filter(Boolean).join(' · '),
              status: w.status,
              priority: w.priority,
            }));
            total += items.length;
          }),
      );
    }

    await Promise.all(queries);

    return NextResponse.json({ results, total });
  } catch (error) {
    console.error('Global search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
