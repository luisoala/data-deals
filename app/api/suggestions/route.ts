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

    const status = request.nextUrl.searchParams.get('status') || 'pending'
    const suggestions = await prisma.suggestion.findMany({
      where: { status },
      include: { deal: true },
      orderBy: { submitted_at: 'desc' },
    })

    const suggestionsWithParsedFields = suggestions.map(s => ({
      ...s,
      fields: JSON.parse(s.fields),
      deal: s.deal ? {
        ...s.deal,
        codes: JSON.parse(s.deal.codes),
      } : null,
    }))

    return NextResponse.json(suggestionsWithParsedFields)
  } catch (error) {
    console.error('Error fetching suggestions:', error)
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deal_id, type, fields } = body

    if (!type || !fields || (type === 'edit' && !deal_id)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const suggestion = await prisma.suggestion.create({
      data: {
        deal_id: deal_id || null,
        type,
        fields: JSON.stringify(fields),
        status: 'pending',
      },
    })

    return NextResponse.json({ ...suggestion, fields: JSON.parse(suggestion.fields) })
  } catch (error) {
    console.error('Error creating suggestion:', error)
    return NextResponse.json({ error: 'Failed to create suggestion' }, { status: 500 })
  }
}

