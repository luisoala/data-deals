// One-time migration script to merge ref-urls.json into deals.json
// This creates a single source of truth where each deal includes its source_url
const fs = require('fs')
const path = require('path')

const dealsPath = path.join(__dirname, '..', 'data', 'deals.json')
const refUrlsPath = path.join(__dirname, '..', 'public', 'data', 'ref-urls.json')

console.log('Loading deals.json...')
const deals = JSON.parse(fs.readFileSync(dealsPath, 'utf-8'))
console.log(`Loaded ${deals.length} deals`)

console.log('Loading ref-urls.json...')
let refUrls = {}
try {
  refUrls = JSON.parse(fs.readFileSync(refUrlsPath, 'utf-8'))
  console.log(`Loaded ${Object.keys(refUrls).length} URL mappings`)
} catch (error) {
  console.warn('Could not load ref-urls.json, continuing without URLs')
}

// Merge URLs into deals
let updatedCount = 0
let missingCount = 0

const updatedDeals = deals.map(deal => {
  const sourceUrl = refUrls[deal.ref] || null
  
  if (sourceUrl) {
    updatedCount++
  } else {
    missingCount++
    if (missingCount <= 5) {
      console.log(`Missing URL for ref: ${deal.ref}`)
    }
  }
  
  // Add source_url field (or update if it already exists)
  return {
    ...deal,
    source_url: sourceUrl
  }
})

// Write updated deals.json
console.log(`\nUpdating deals.json...`)
console.log(`  Deals with URLs: ${updatedCount}`)
console.log(`  Deals without URLs: ${missingCount}`)

fs.writeFileSync(dealsPath, JSON.stringify(updatedDeals, null, 2))
console.log(`\n✓ Successfully merged URLs into deals.json`)
console.log(`  All ${deals.length} deals now include source_url field`)
console.log(`  File: ${dealsPath}`)

// Also update public/data/deals.json if it exists (for client-side access)
const publicDealsPath = path.join(__dirname, '..', 'public', 'data', 'deals.json')
if (fs.existsSync(publicDealsPath)) {
  fs.writeFileSync(publicDealsPath, JSON.stringify(updatedDeals, null, 2))
  console.log(`  Also updated: ${publicDealsPath}`)
}

console.log('\nMigration complete!')
console.log('\nNext steps:')
console.log('  1. Review data/deals.json to verify source_url fields')
console.log('  2. Update scripts/sync-json-to-db.ts to read source_url from deals.json')
console.log('  3. Update scripts/parse-bib-urls.js to merge URLs into deals.json')
console.log('  4. Update scripts/extract-deals.js to include source_url in data model')

