import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const yearMin = searchParams.get('yearMin')
    const yearMax = searchParams.get('yearMax')
    const valueMin = searchParams.get('valueMin')
    const valueMax = searchParams.get('valueMax')
    const types = searchParams.get('types')?.split(',')
    const codes = searchParams.get('codes')?.split(',')
    const receivers = searchParams.get('receivers')?.split(',')
    const aggregators = searchParams.get('aggregators')?.split(',')

    const where: any = {}

    if (yearMin || yearMax) {
      where.date = {}
      if (yearMin) where.date.gte = parseInt(yearMin)
      if (yearMax) where.date.lte = parseInt(yearMax)
    }

    if (valueMin || valueMax) {
      where.OR = [
        { value_min: { gte: valueMin ? parseFloat(valueMin) : undefined } },
        { value_max: { lte: valueMax ? parseFloat(valueMax) : undefined } },
      ].filter(condition => Object.values(condition).some(v => v !== undefined))
    }

    if (types && types.length > 0) {
      where.type = { in: types }
    }

    if (receivers && receivers.length > 0) {
      where.data_receiver = { in: receivers }
    }

    if (aggregators && aggregators.length > 0) {
      where.data_aggregator = { in: aggregators }
    }

    const deals = await prisma.deal.findMany({
      where,
      orderBy: { date: 'desc' },
    })

    // Filter by codes in application layer (since codes is JSON string)
    let filteredDeals = deals
    if (codes && codes.length > 0) {
      filteredDeals = deals.filter(deal => {
        const dealCodes = JSON.parse(deal.codes)
        return codes.some(code => dealCodes.includes(code))
      })
    }

    // Parse codes back to arrays
    const dealsWithParsedCodes = filteredDeals.map(deal => ({
      ...deal,
      codes: JSON.parse(deal.codes),
    }))

    return NextResponse.json(dealsWithParsedCodes)
  } catch (error) {
    console.error('Error fetching deals:', error)
    return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 })
  }
}

