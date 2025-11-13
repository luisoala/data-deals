// Parse bib files to extract reference URLs
const fs = require('fs')
const path = require('path')

function parseBibFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const entries = {}
  
  // Match bib entries
  const entryRegex = /@\w+\{([^,]+),[\s\S]*?\n\}/g
  let match
  
  while ((match = entryRegex.exec(content)) !== null) {
    const entryContent = match[0]
    const key = match[1]
    
    // Extract URL
    const urlMatch = entryContent.match(/url\s*=\s*\{?([^}]+)\}?/i)
    const noteMatch = entryContent.match(/note\s*=\s*\\url\{([^}]+)\}/i)
    
    let url = null
    if (urlMatch) {
      url = urlMatch[1].trim()
    } else if (noteMatch) {
      url = noteMatch[1].trim()
    }
    
    if (url) {
      entries[key] = url
    }
  }
  
  return entries
}

// Parse all bib files
const bibDir = path.join(__dirname, '..', 'data_deals-neurips_camera_ready-latex')
const bibFiles = ['ref2.bib', 'ref3.bib', 'ref_cracks.bib']

let allUrls = {}
bibFiles.forEach(file => {
  const filePath = path.join(bibDir, file)
  if (fs.existsSync(filePath)) {
    const urls = parseBibFile(filePath)
    allUrls = { ...allUrls, ...urls }
  }
})

// Write to JSON
const outputPath = path.join(__dirname, '..', 'data', 'ref-urls.json')
fs.writeFileSync(outputPath, JSON.stringify(allUrls, null, 2))
console.log(`Extracted ${Object.keys(allUrls).length} URLs to ${outputPath}`)

