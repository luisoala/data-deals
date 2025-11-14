// Parse bib files to extract reference URLs
const fs = require('fs')
const path = require('path')

function parseBibFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const entries = {}
  
  // Match bib entries - handle multi-line entries properly
  // Look for @type{key, ... } where closing brace can be on separate line
  const entryRegex = /@\w+\{([^,]+),[\s\S]*?\n\s*\}/g
  let match
  
  while ((match = entryRegex.exec(content)) !== null) {
    const entryContent = match[0]
    const key = match[1]
    
    // Extract URL - try multiple patterns
    let url = null
    
    // Pattern 1: url = {...} or url = ...
    const urlMatch = entryContent.match(/url\s*=\s*\{?([^}]+)\}?/i)
    if (urlMatch) {
      url = urlMatch[1].trim()
    }
    
    // Pattern 2: note = {\url{...}} - handle escaped backslash
    if (!url) {
      const noteMatch = entryContent.match(/note\s*=\s*\{?\\url\{([^}]+)\}\}?/i)
      if (noteMatch) {
        url = noteMatch[1].trim()
      }
    }
    
    // Pattern 3: note = {https://...} (without \url wrapper, direct URL)
    if (!url) {
      const noteUrlMatch = entryContent.match(/note\s*=\s*\{?\s*(https?:\/\/[^\s}]+)\s*\}?/i)
      if (noteUrlMatch) {
        url = noteUrlMatch[1].trim()
      }
    }
    
    // Pattern 4: note = {...} containing URL anywhere
    if (!url) {
      const noteContentMatch = entryContent.match(/note\s*=\s*\{([^}]+)\}/i)
      if (noteContentMatch) {
        const urlInNote = noteContentMatch[1].match(/(https?:\/\/[^\s}]+)/i)
        if (urlInNote) {
          url = urlInNote[1].trim()
        }
      }
    }
    
    if (url) {
      // Clean up URL - remove trailing punctuation if any
      url = url.replace(/[,;.]$/, '')
      entries[key] = url
    }
  }
  
  return entries
}

// Parse all bib files
const bibDir = path.join(__dirname, '..', 'data_deals-neurips_camera_ready-latex')
const bibFiles = ['ref.bib', 'ref2.bib', 'ref3.bib', 'ref_cracks.bib']

let allUrls = {}
bibFiles.forEach(file => {
  const filePath = path.join(bibDir, file)
  if (fs.existsSync(filePath)) {
    const urls = parseBibFile(filePath)
    allUrls = { ...allUrls, ...urls }
  }
})

// Write to JSON (both locations for compatibility)
const dataPath = path.join(__dirname, '..', 'data', 'ref-urls.json')
const publicPath = path.join(__dirname, '..', 'public', 'data', 'ref-urls.json')
const jsonContent = JSON.stringify(allUrls, null, 2)
fs.writeFileSync(dataPath, jsonContent)
fs.writeFileSync(publicPath, jsonContent)
console.log(`Extracted ${Object.keys(allUrls).length} URLs`)
console.log(`Written to: ${dataPath}`)
console.log(`Written to: ${publicPath}`)

