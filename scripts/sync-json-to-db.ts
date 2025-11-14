import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

// Parse value string to extract min, max, unit (same logic as extract script)
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

async function main() {
  const jsonPath = path.join(process.cwd(), 'data', 'deals.json')
  const dealsData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))

  // Load ref-to-URL mapping
  const refUrlsPath = path.join(process.cwd(), 'public', 'data', 'ref-urls.json')
  let refUrls: Record<string, string> = {}
  try {
    refUrls = JSON.parse(fs.readFileSync(refUrlsPath, 'utf-8'))
    console.log(`Loaded ${Object.keys(refUrls).length} URL mappings`)
  } catch (error) {
    console.warn('Could not load ref-urls.json, continuing without source URLs')
  }

  console.log(`Syncing ${dealsData.length} deals to database...`)

  for (const deal of dealsData) {
    // Get source URL from ref-urls.json mapping
    const sourceUrl = refUrls[deal.ref] || null

    await prisma.deal.upsert({
      where: { id: deal.id },
      update: {
        data_receiver: deal.data_receiver,
        data_aggregator: deal.data_aggregator,
        ref: deal.ref,
        date: deal.date,
        type: deal.type,
        value_raw: deal.value_raw,
        value_min: deal.value_min,
        value_max: deal.value_max,
        value_unit: deal.value_unit,
        codes: JSON.stringify(deal.codes),
        source_url: sourceUrl,
      },
      create: {
        id: deal.id,
        data_receiver: deal.data_receiver,
        data_aggregator: deal.data_aggregator,
        ref: deal.ref,
        date: deal.date,
        type: deal.type,
        value_raw: deal.value_raw,
        value_min: deal.value_min,
        value_max: deal.value_max,
        value_unit: deal.value_unit,
        codes: JSON.stringify(deal.codes),
        source_url: sourceUrl,
      },
    })
  }

  console.log('Sync complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

