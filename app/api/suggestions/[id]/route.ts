import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

// Parse value string to extract min, max, unit (same logic as sync-json-to-db.ts)
function parseValue(valueStr: string) {
  if (!valueStr || valueStr.toLowerCase() === 'undisclosed') {
    return {
      value_raw: valueStr || 'Undisclosed',
      value_min: null,
      value_max: null,
      value_unit: null
    }
  }

  const clean = valueStr.trim()
  
  // Handle ranges like "25-50m"
  const rangeMatch = clean.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*([km])(?:\/.*)?$/i)
  if (rangeMatch) {
    const [, min, max, unit] = rangeMatch
    const multiplier = unit.toLowerCase() === 'k' ? 1000 : 1000000
    return {
      value_raw: valueStr,
      value_min: parseFloat(min) * multiplier,
      value_max: parseFloat(max) * multiplier,
      value_unit: unit.toLowerCase() === 'k' ? 'thousands' : 'millions'
    }
  }

  // Handle single values with unit like "10m", "25m", "44m"
  const singleMatch = clean.match(/^(\d+(?:\.\d+)?)\s*([km])(?:\/.*)?$/i)
  if (singleMatch) {
    const [, val, unit] = singleMatch
    const multiplier = unit.toLowerCase() === 'k' ? 1000 : 1000000
    const numVal = parseFloat(val) * multiplier
    return {
      value_raw: valueStr,
      value_min: numVal,
      value_max: numVal,
      value_unit: unit.toLowerCase() === 'k' ? 'thousands' : 'millions'
    }
  }

  // Handle values with time period like "250m/5yr", "60m/yr", "2.5m/yr"
  const periodMatch = clean.match(/^(\d+(?:\.\d+)?)\s*([km])\/(\d+)?\s*yr$/i)
  if (periodMatch) {
    const [, val, unit, years] = periodMatch
    const multiplier = unit.toLowerCase() === 'k' ? 1000 : 1000000
    const numVal = parseFloat(val) * multiplier
    return {
      value_raw: valueStr,
      value_min: numVal,
      value_max: numVal,
      value_unit: years ? `${years}-year total` : 'annual'
    }
  }

  // Handle special cases like "2.5k/book"
  const perUnitMatch = clean.match(/^(\d+(?:\.\d+)?)\s*([km])\/(.+)$/i)
  if (perUnitMatch) {
    const [, val, unit, unitType] = perUnitMatch
    const multiplier = unit.toLowerCase() === 'k' ? 1000 : 1000000
    const numVal = parseFloat(val) * multiplier
    return {
      value_raw: valueStr,
      value_min: numVal,
      value_max: numVal,
      value_unit: `per ${unitType}`
    }
  }

  // Handle values with + like "20m+"
  const plusMatch = clean.match(/^(\d+(?:\.\d+)?)\s*([km])\+$/i)
  if (plusMatch) {
    const [, val, unit] = plusMatch
    const multiplier = unit.toLowerCase() === 'k' ? 1000 : 1000000
    const numVal = parseFloat(val) * multiplier
    return {
      value_raw: valueStr,
      value_min: numVal,
      value_max: null,
      value_unit: unit.toLowerCase() === 'k' ? 'thousands' : 'millions'
    }
  }

  return {
    value_raw: valueStr,
    value_min: null,
    value_max: null,
    value_unit: null
  }
}

// Update deals.json when approving suggestions (keep ground truth in sync)
async function updateDealsJson(dealData: any, isNew: boolean) {
  try {
    const dealsPath = path.join(process.cwd(), 'data', 'deals.json')
    const deals = JSON.parse(fs.readFileSync(dealsPath, 'utf-8'))
    
    if (isNew) {
      // Add new deal - find max ID and increment
      const maxId = Math.max(...deals.map((d: any) => d.id), 0)
      deals.push({
        ...dealData,
        id: maxId + 1
      })
    } else {
      // Update existing deal
      const index = deals.findIndex((d: any) => d.id === dealData.id)
      if (index !== -1) {
        deals[index] = dealData
      } else {
        console.warn(`Deal with id ${dealData.id} not found in deals.json`)
      }
    }
    
    fs.writeFileSync(dealsPath, JSON.stringify(deals, null, 2))
  } catch (error) {
    console.error('Error updating deals.json:', error)
    // Don't throw - database update succeeded, JSON update is secondary
  }
}

// Helper function to get IP address from request
function getIpAddress(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  return null
}

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

    const reviewer = session.user.githubUsername || 'unknown'
    const ipAddress = getIpAddress(request)

    if (action === 'approve') {
      const fields = JSON.parse(suggestion.fields)
      
      // Parse value_raw if not already parsed
      const parsedValue = fields.value_min === undefined && fields.value_max === undefined
        ? parseValue(fields.value_raw)
        : {
            value_raw: fields.value_raw,
            value_min: fields.value_min ?? null,
            value_max: fields.value_max ?? null,
            value_unit: fields.value_unit ?? null
          }

      if (suggestion.type === 'new') {
        // Create new deal
        const newDeal = await prisma.deal.create({
          data: {
            data_receiver: fields.data_receiver,
            data_aggregator: fields.data_aggregator,
            ref: fields.ref,
            date: fields.date,
            type: fields.type,
            value_raw: parsedValue.value_raw,
            value_min: parsedValue.value_min,
            value_max: parsedValue.value_max,
            value_unit: parsedValue.value_unit,
            codes: JSON.stringify(fields.codes || []),
            source_url: fields.source_url || null,
          },
        })

        await prisma.suggestion.update({
          where: { id: suggestion.id },
          data: {
            status: 'approved',
            reviewed_at: new Date(),
            reviewed_by: reviewer,
          },
        })

        // Create audit log for suggestion approval
        await prisma.auditLog.create({
          data: {
            action: 'suggestion_approved',
            entity_type: 'suggestion',
            entity_id: suggestion.id,
            user: reviewer,
            ip_address: ipAddress,
            details: JSON.stringify({
              suggestion_type: suggestion.type,
              deal_id: newDeal.id,
              deal_ref: newDeal.ref,
            }),
          },
        })

        // Create audit log for deal creation
        await prisma.auditLog.create({
          data: {
            action: 'deal_created',
            entity_type: 'deal',
            entity_id: newDeal.id,
            user: reviewer,
            ip_address: ipAddress,
            details: JSON.stringify({
              via_suggestion: suggestion.id,
              data_receiver: newDeal.data_receiver,
              data_aggregator: newDeal.data_aggregator,
              ref: newDeal.ref,
            }),
          },
        })

        // Update deals.json (ground truth)
        const dealForJson = {
          id: newDeal.id,
          data_receiver: newDeal.data_receiver,
          data_aggregator: newDeal.data_aggregator,
          ref: newDeal.ref,
          date: newDeal.date,
          type: newDeal.type,
          value_raw: newDeal.value_raw,
          value_min: newDeal.value_min,
          value_max: newDeal.value_max,
          value_unit: newDeal.value_unit,
          codes: JSON.parse(newDeal.codes),
          source_url: newDeal.source_url,
        }
        await updateDealsJson(dealForJson, true)

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
            value_raw: parsedValue.value_raw,
            value_min: parsedValue.value_min,
            value_max: parsedValue.value_max,
            value_unit: parsedValue.value_unit,
            codes: JSON.stringify(fields.codes || []),
            source_url: fields.source_url || null,
          },
        })

        await prisma.suggestion.update({
          where: { id: suggestion.id },
          data: {
            status: 'approved',
            reviewed_at: new Date(),
            reviewed_by: reviewer,
          },
        })

        // Create audit log for suggestion approval
        await prisma.auditLog.create({
          data: {
            action: 'suggestion_approved',
            entity_type: 'suggestion',
            entity_id: suggestion.id,
            user: reviewer,
            ip_address: ipAddress,
            details: JSON.stringify({
              suggestion_type: suggestion.type,
              deal_id: updatedDeal.id,
              deal_ref: updatedDeal.ref,
            }),
          },
        })

        // Create audit log for deal update
        await prisma.auditLog.create({
          data: {
            action: 'deal_updated',
            entity_type: 'deal',
            entity_id: updatedDeal.id,
            user: reviewer,
            ip_address: ipAddress,
            details: JSON.stringify({
              via_suggestion: suggestion.id,
              data_receiver: updatedDeal.data_receiver,
              data_aggregator: updatedDeal.data_aggregator,
              ref: updatedDeal.ref,
            }),
          },
        })

        // Update deals.json (ground truth)
        const dealForJson = {
          id: updatedDeal.id,
          data_receiver: updatedDeal.data_receiver,
          data_aggregator: updatedDeal.data_aggregator,
          ref: updatedDeal.ref,
          date: updatedDeal.date,
          type: updatedDeal.type,
          value_raw: updatedDeal.value_raw,
          value_min: updatedDeal.value_min,
          value_max: updatedDeal.value_max,
          value_unit: updatedDeal.value_unit,
          codes: JSON.parse(updatedDeal.codes),
          source_url: updatedDeal.source_url,
        }
        await updateDealsJson(dealForJson, false)

        return NextResponse.json({ deal: { ...updatedDeal, codes: JSON.parse(updatedDeal.codes) } })
      }
    } else {
      // Reject
      await prisma.suggestion.update({
        where: { id: suggestion.id },
        data: {
          status: 'rejected',
          reviewed_at: new Date(),
          reviewed_by: reviewer,
        },
      })

      // Create audit log for suggestion rejection
      await prisma.auditLog.create({
        data: {
          action: 'suggestion_rejected',
          entity_type: 'suggestion',
          entity_id: suggestion.id,
          user: reviewer,
          ip_address: ipAddress,
          details: JSON.stringify({
            suggestion_type: suggestion.type,
            deal_id: suggestion.deal_id,
          }),
        },
      })

      return NextResponse.json({ message: 'Suggestion rejected' })
    }
  } catch (error) {
    console.error('Error processing suggestion:', error)
    return NextResponse.json({ error: 'Failed to process suggestion' }, { status: 500 })
  }
}

