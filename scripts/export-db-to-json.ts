// Export database to deals.json (reverse of sync-json-to-db.ts)
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
  const jsonPath = path.join(process.cwd(), 'data', 'deals.json')
  
  console.log('Exporting database to deals.json...')
  
  const deals = await prisma.deal.findMany({
    orderBy: { id: 'asc' },
  })

  const dealsForJson = deals.map(deal => ({
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
    codes: JSON.parse(deal.codes),
    source_url: deal.source_url,
  }))

  fs.writeFileSync(jsonPath, JSON.stringify(dealsForJson, null, 2))
  console.log(`Exported ${dealsForJson.length} deals to ${jsonPath}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

