import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body // 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const suggestion = await prisma.suggestion.findUnique({
      where: { id: parseInt(params.id) },
      include: { deal: true },
    })

    if (!suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
    }

    if (action === 'approve') {
      const fields = JSON.parse(suggestion.fields)

      if (suggestion.type === 'new') {
        // Create new deal
        const newDeal = await prisma.deal.create({
          data: {
            data_receiver: fields.data_receiver,
            data_aggregator: fields.data_aggregator,
            ref: fields.ref,
            date: fields.date,
            type: fields.type,
            value_raw: fields.value_raw,
            value_min: fields.value_min,
            value_max: fields.value_max,
            value_unit: fields.value_unit,
            codes: JSON.stringify(fields.codes),
          },
        })

        await prisma.suggestion.update({
          where: { id: suggestion.id },
          data: {
            status: 'approved',
            reviewed_at: new Date(),
            reviewed_by: session.user.githubUsername || null,
          },
        })

        return NextResponse.json({ deal: { ...newDeal, codes: JSON.parse(newDeal.codes) } })
      } else {
        // Update existing deal
        const updatedDeal = await prisma.deal.update({
          where: { id: suggestion.deal_id! },
          data: {
            data_receiver: fields.data_receiver,
            data_aggregator: fields.data_aggregator,
            ref: fields.ref,
            date: fields.date,
            type: fields.type,
            value_raw: fields.value_raw,
            value_min: fields.value_min,
            value_max: fields.value_max,
            value_unit: fields.value_unit,
            codes: JSON.stringify(fields.codes),
          },
        })

        await prisma.suggestion.update({
          where: { id: suggestion.id },
          data: {
            status: 'approved',
            reviewed_at: new Date(),
            reviewed_by: session.user.githubUsername || null,
          },
        })

        return NextResponse.json({ deal: { ...updatedDeal, codes: JSON.parse(updatedDeal.codes) } })
      }
    } else {
      // Reject
      await prisma.suggestion.update({
        where: { id: suggestion.id },
        data: {
          status: 'rejected',
          reviewed_at: new Date(),
          reviewed_by: session.user.githubUsername || null,
        },
      })

      return NextResponse.json({ message: 'Suggestion rejected' })
    }
  } catch (error) {
    console.error('Error processing suggestion:', error)
    return NextResponse.json({ error: 'Failed to process suggestion' }, { status: 500 })
  }
}

