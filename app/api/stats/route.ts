import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const deals = await prisma.deal.findMany()

    // Year distribution
    const yearCounts: Record<number, number> = {}
    deals.forEach(deal => {
      yearCounts[deal.date] = (yearCounts[deal.date] || 0) + 1
    })

    // Type distribution
    const typeCounts: Record<string, number> = {}
    deals.forEach(deal => {
      typeCounts[deal.type] = (typeCounts[deal.type] || 0) + 1
    })

    // Code distribution
    const codeCounts: Record<string, number> = {}
    deals.forEach(deal => {
      const codes = JSON.parse(deal.codes)
      codes.forEach((code: string) => {
        codeCounts[code] = (codeCounts[code] || 0) + 1
      })
    })

    // Value range - include disclosed values, but account for "Undisclosed"
    // Convert from dollars to millions for UI consistency
    const values = deals
      .map(d => d.value_min || d.value_max)
      .filter(v => v !== null)
      .map(v => (v as number) / 1000000) as number[] // Convert to millions
    const valueMin = 0
    const valueMax = values.length > 0 ? Math.max(...values) : 0
    // Add a buffer for "Undisclosed" - set max to be slightly above the highest disclosed value
    const valueMaxWithUndisclosed = valueMax * 1.1

    // Entity counts
    const receiverCounts: Record<string, number> = {}
    const aggregatorCounts: Record<string, number> = {}
    deals.forEach(deal => {
      receiverCounts[deal.data_receiver] = (receiverCounts[deal.data_receiver] || 0) + 1
      aggregatorCounts[deal.data_aggregator] = (aggregatorCounts[deal.data_aggregator] || 0) + 1
    })

    return NextResponse.json({
      yearCounts,
      typeCounts,
      codeCounts,
      valueRange: { min: valueMin, max: valueMaxWithUndisclosed },
      receiverCounts,
      aggregatorCounts,
      totalDeals: deals.length,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}

