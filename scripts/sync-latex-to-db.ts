// Script to sync LaTeX table data to database and extract URLs from bib files
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Parse value string to extract min, max, unit (same logic as extract-deals.js)
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

  // Default: return as-is
  return {
    value_raw: valueStr,
    value_min: null,
    value_max: null,
    value_unit: null
  }
}

// Parse bib file to extract URLs
function parseBibFile(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, 'utf-8')
  const entries: Record<string, string> = {}
  
  // Match bib entries - improved regex to handle multiline entries
  // Look for @type{key, ... } pattern, matching across newlines
  const entryRegex = /@\w+\{([^,]+),([\s\S]*?)\n\}/g
  let match
  
  while ((match = entryRegex.exec(content)) !== null) {
    const entryContent = match[0]
    const key = match[1]
    
    // Extract URL - try multiple patterns
    let url: string | null = null
    
    // Pattern 1: url = { ... } or url = "..." or url = ...
    const urlPatterns = [
      /url\s*=\s*\{([^}]+)\}/i,
      /url\s*=\s*"([^"]+)"/i,
      /url\s*=\s*([^\s,}]+)/i
    ]
    
    for (const pattern of urlPatterns) {
      const urlMatch = entryContent.match(pattern)
      if (urlMatch) {
        url = urlMatch[1].trim()
        break
      }
    }
    
    // Pattern 2: note = {\url{...}} or note = {...\url{...}...}
    if (!url) {
      const noteUrlPatterns = [
        /note\s*=\s*\{[^}]*\\url\{([^}]+)\}[^}]*\}/i,
        /note\s*=\s*\\url\{([^}]+)\}/i
      ]
      
      for (const pattern of noteUrlPatterns) {
        const noteUrlMatch = entryContent.match(pattern)
        if (noteUrlMatch) {
          url = noteUrlMatch[1].trim()
          break
        }
      }
    }
    
    // Pattern 3: Look for URLs in note field that might be wrapped differently
    if (!url) {
      // Try to find any URL-like string in the note field
      const noteMatch = entryContent.match(/note\s*=\s*\{([^}]+)\}/i)
      if (noteMatch) {
        const noteContent = noteMatch[1]
        // Look for http:// or https:// URLs
        const httpMatch = noteContent.match(/(https?:\/\/[^\s}]+)/i)
        if (httpMatch) {
          url = httpMatch[1].trim()
        }
      }
    }
    
    if (url) {
      // Clean up URL - remove trailing commas, whitespace, and LaTeX commands
      url = url
        .replace(/,$/, '')
        .replace(/\\url\{/g, '')
        .replace(/\}$/, '')
        .trim()
      
      // Validate it looks like a URL
      if (url.startsWith('http://') || url.startsWith('https://')) {
        entries[key] = url
      }
    }
  }
  
  return entries
}

// Extract deals from LaTeX table
function extractDealsFromLatex(latexPath: string) {
  const content = fs.readFileSync(latexPath, 'utf-8')
  const deals: Array<{
    data_receiver: string
    data_aggregator: string
    ref: string
    date: number
    type: string
    value_raw: string
    codes: string[]
  }> = []
  
  // Match table rows - look for lines with & separators
  const lines = content.split('\n')
  let inTable = false
  
  for (const line of lines) {
    // Start of table data
    if (line.includes('\\midrule')) {
      inTable = true
      continue
    }
    
    // End of table
    if (line.includes('\\bottomrule')) {
      break
    }
    
    if (!inTable) continue
    
    // Match table row: Data Receiver & Data Aggregator & \citedeal{ref} & Date & Type & Value & Codes \\
    // Handle LaTeX escaping and special characters
    // More flexible regex to handle various LaTeX escaping
    const rowMatch = line.match(/^\s*(.+?)\s*&\s*(.+?)\s*&\s*\\citedeal\{([^}]+)\}\s*&\s*(\d+)\s*&\s*(.+?)\s*&\s*(.+?)\s*&\s*(.+?)(?:\s*\\\\\s*)?$/)
    if (rowMatch) {
      const [, receiver, aggregator, ref, date, type, value, codes] = rowMatch
      
      // Clean up LaTeX escaping
      const cleanReceiver = receiver
        .replace(/\\&/g, '&')
        .replace(/\\'/g, "'")
        .replace(/\\textbackslash/g, '\\')
        .replace(/\\'/g, "'")
        .replace(/Cond\\'e/g, "Condé")
        .trim()
      
      const cleanAggregator = aggregator
        .replace(/\\&/g, '&')
        .replace(/\\'/g, "'")
        .replace(/\\textbackslash/g, '\\')
        .trim()
      
      const cleanType = type.trim()
      const cleanValue = value.trim()
      // Codes can be separated by commas or spaces
      const cleanCodes = codes
        .split(/[, ]+/)
        .map(c => c.trim())
        .filter(c => c.length > 0)
      
      deals.push({
        data_receiver: cleanReceiver,
        data_aggregator: cleanAggregator,
        ref: ref.trim(),
        date: parseInt(date),
        type: cleanType,
        value_raw: cleanValue,
        codes: cleanCodes
      })
    }
  }
  
  return deals
}

async function main() {
  console.log('Starting database sync from LaTeX table...')
  
  // Extract deals from LaTeX table
  const latexPath = path.join(__dirname, '..', 'data_deals-neurips_camera_ready-latex', 'deals_table_joined.tex')
  const latexDeals = extractDealsFromLatex(latexPath)
  console.log(`Extracted ${latexDeals.length} deals from LaTeX table`)
  
  // Parse bib files to get URLs
  const bibDir = path.join(__dirname, '..', 'data_deals-neurips_camera_ready-latex')
  const bibFiles = ['ref2.bib', 'ref3.bib']
  let allUrls: Record<string, string> = {}
  
  for (const bibFile of bibFiles) {
    const bibPath = path.join(bibDir, bibFile)
    if (fs.existsSync(bibPath)) {
      const urls = parseBibFile(bibPath)
      console.log(`Extracted ${Object.keys(urls).length} URLs from ${bibFile}`)
      allUrls = { ...allUrls, ...urls }
    }
  }
  
  console.log(`Total URLs extracted: ${Object.keys(allUrls).length}`)
  
  // Save ref-urls.json
  const refUrlsPath = path.join(__dirname, '..', 'data', 'ref-urls.json')
  fs.writeFileSync(refUrlsPath, JSON.stringify(allUrls, null, 2))
  console.log(`Saved ref-urls.json`)
  
  // Get all existing deals from database
  const existingDeals = await prisma.deal.findMany()
  console.log(`Found ${existingDeals.length} existing deals in database`)
  
  // Process each deal from LaTeX table
  let created = 0
  let updated = 0
  let skipped = 0
  
  for (let i = 0; i < latexDeals.length; i++) {
    const latexDeal = latexDeals[i]
    const parsedValue = parseValue(latexDeal.value_raw)
    const sourceUrl = allUrls[latexDeal.ref] || null
    
    // Try to find existing deal by ref (most reliable identifier)
    const existingDeal = existingDeals.find(d => d.ref === latexDeal.ref)
    
    const dealData = {
      data_receiver: latexDeal.data_receiver,
      data_aggregator: latexDeal.data_aggregator,
      ref: latexDeal.ref,
      date: latexDeal.date,
      type: latexDeal.type,
      value_raw: parsedValue.value_raw,
      value_min: parsedValue.value_min,
      value_max: parsedValue.value_max,
      value_unit: parsedValue.value_unit,
      codes: JSON.stringify(latexDeal.codes),
      source_url: sourceUrl
    }
    
    if (existingDeal) {
      // Update existing deal
      await prisma.deal.update({
        where: { id: existingDeal.id },
        data: dealData
      })
      updated++
      
      if (!sourceUrl) {
        console.log(`  Warning: No URL found for ref: ${latexDeal.ref}`)
      }
    } else {
      // Create new deal
      await prisma.deal.create({
        data: dealData
      })
      created++
      
      if (!sourceUrl) {
        console.log(`  Warning: No URL found for ref: ${latexDeal.ref}`)
      }
    }
  }
  
  // Find deals in database that are not in LaTeX table (to be removed or flagged)
  const latexRefs = new Set(latexDeals.map(d => d.ref))
  const orphanedDeals = existingDeals.filter(d => !latexRefs.has(d.ref))
  
  if (orphanedDeals.length > 0) {
    console.log(`\nWarning: Found ${orphanedDeals.length} deals in database not in LaTeX table:`)
    orphanedDeals.forEach(d => {
      console.log(`  - ID ${d.id}: ${d.data_receiver} & ${d.data_aggregator} (ref: ${d.ref})`)
    })
    console.log('  These deals will NOT be deleted automatically. Review manually if needed.')
  }
  
  console.log(`\nSync complete:`)
  console.log(`  Created: ${created}`)
  console.log(`  Updated: ${updated}`)
  console.log(`  Total deals in LaTeX table: ${latexDeals.length}`)
  console.log(`  URLs matched: ${latexDeals.filter(d => allUrls[d.ref]).length}/${latexDeals.length}`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

