import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const action = searchParams.get('action')
    const entityType = searchParams.get('entity_type')
    const userId = searchParams.get('user')

    // Build where clause
    const where: any = {}
    if (action) {
      where.action = action
    }
    if (entityType) {
      where.entity_type = entityType
    }
    if (userId) {
      where.user = userId
    }

    // Fetch audit logs
    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ])

    // Parse details JSON
    const logsWithParsedDetails = auditLogs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null,
    }))

    return NextResponse.json({
      logs: logsWithParsedDetails,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
  }
}

