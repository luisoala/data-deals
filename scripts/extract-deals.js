// Script to extract deals from LaTeX table to JSON
const fs = require('fs');
const path = require('path');

// Parse value string to extract min, max, unit
function parseValue(valueStr) {
  if (!valueStr || valueStr.toLowerCase() === 'undisclosed') {
    return {
      value_raw: valueStr || 'Undisclosed',
      value_min: null,
      value_max: null,
      value_unit: null
    };
  }

  // Remove whitespace and convert to lowercase for parsing
  const clean = valueStr.trim();
  
  // Handle ranges like "25-50m"
  const rangeMatch = clean.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*([km])(?:\/.*)?$/i);
  if (rangeMatch) {
    const [, min, max, unit] = rangeMatch;
    const multiplier = unit.toLowerCase() === 'k' ? 1000 : 1000000;
    return {
      value_raw: valueStr,
      value_min: parseFloat(min) * multiplier,
      value_max: parseFloat(max) * multiplier,
      value_unit: unit.toLowerCase() === 'k' ? 'thousands' : 'millions'
    };
  }

  // Handle single values with unit like "10m", "25m", "44m"
  const singleMatch = clean.match(/^(\d+(?:\.\d+)?)\s*([km])(?:\/.*)?$/i);
  if (singleMatch) {
    const [, val, unit] = singleMatch;
    const multiplier = unit.toLowerCase() === 'k' ? 1000 : 1000000;
    const numVal = parseFloat(val) * multiplier;
    return {
      value_raw: valueStr,
      value_min: numVal,
      value_max: numVal,
      value_unit: unit.toLowerCase() === 'k' ? 'thousands' : 'millions'
    };
  }

  // Handle values with time period like "250m/5yr", "60m/yr", "2.5m/yr"
  const periodMatch = clean.match(/^(\d+(?:\.\d+)?)\s*([km])\/(\d+)?\s*yr$/i);
  if (periodMatch) {
    const [, val, unit, years] = periodMatch;
    const multiplier = unit.toLowerCase() === 'k' ? 1000 : 1000000;
    const numVal = parseFloat(val) * multiplier;
    // For annualized values, we'll store the annual amount
    return {
      value_raw: valueStr,
      value_min: numVal,
      value_max: numVal,
      value_unit: years ? `${years}-year total` : 'annual'
    };
  }

  // Handle special cases like "2.5k/book"
  const perUnitMatch = clean.match(/^(\d+(?:\.\d+)?)\s*([km])\/(.+)$/i);
  if (perUnitMatch) {
    const [, val, unit, unitType] = perUnitMatch;
    const multiplier = unit.toLowerCase() === 'k' ? 1000 : 1000000;
    const numVal = parseFloat(val) * multiplier;
    return {
      value_raw: valueStr,
      value_min: numVal,
      value_max: numVal,
      value_unit: `per ${unitType}`
    };
  }

  // Handle values with + like "20m+"
  const plusMatch = clean.match(/^(\d+(?:\.\d+)?)\s*([km])\+$/i);
  if (plusMatch) {
    const [, val, unit] = plusMatch;
    const multiplier = unit.toLowerCase() === 'k' ? 1000 : 1000000;
    const numVal = parseFloat(val) * multiplier;
    return {
      value_raw: valueStr,
      value_min: numVal,
      value_max: null, // Unknown upper bound
      value_unit: unit.toLowerCase() === 'k' ? 'thousands' : 'millions'
    };
  }

  // Default: return as-is
  return {
    value_raw: valueStr,
    value_min: null,
    value_max: null,
    value_unit: null
  };
}

// Raw data extracted from LaTeX table
const rawDeals = [
  { receiver: 'DeepMind', aggregator: 'Moorfields Hospital', ref: 'moorfieldsdeepmind2016', date: 2016, type: 'Academic', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'DeepMind', aggregator: 'NHS', ref: 'deepmindnhs2017t', date: 2017, type: 'Academic', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'GitHub (Microsoft)', ref: 'githubcopilotlawsuit2022t', date: 2018, type: 'UGC', value: 'Undisclosed', codes: ['L'] },
  { receiver: 'Adobe', aggregator: 'Stock Contributors', ref: 'adobefirefly2023', date: 2022, type: 'Images', value: 'Undisclosed', codes: ['C', 'S'] },
  { receiver: 'Various Licensees', aggregator: 'X (formerly Twitter)', ref: 'variouslicenseesbloombergibmetcxtwitter2023', date: 2023, type: 'UGC', value: '2.5m/yr', codes: ['C', 'R'] },
  { receiver: 'OpenAI', aggregator: 'Axel Springer', ref: 'openaias2023', date: 2023, type: 'News', value: '20m+', codes: ['C'] },
  { receiver: 'Apple', aggregator: 'Publishers', ref: 'applepublishers2023', date: 2023, type: 'News', value: 'Undisclosed', codes: ['U'] },
  { receiver: 'ElevenLabs', aggregator: 'Voice Actors', ref: 'elevenlabsvoice2023', date: 2023, type: 'UGC', value: 'Undisclosed', codes: ['C', 'S'] },
  { receiver: 'IBM', aggregator: 'NASA', ref: 'nasaibm2023', date: 2023, type: 'Images', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'LG', aggregator: 'Shutterstock', ref: 'lgshutterstock2023', date: 2023, type: 'Images', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'Meta', aggregator: 'Shutterstock', ref: 'metashutterstock2023', date: 2023, type: 'Images', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'Mubert', aggregator: 'Musicians', ref: 'mubertmusicians2023', date: 2023, type: 'UGC', value: 'Undisclosed', codes: ['C', 'S'] },
  { receiver: 'NVIDIA', aggregator: 'Getty Images', ref: 'nvidiagettyimages2023', date: 2023, type: 'Images', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'Associated Press', ref: 'openaiap2023t', date: 2023, type: 'News', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'Shutterstock', ref: 'openaishutterstock2023', date: 2023, type: 'Images', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'StackOverflow', ref: 'openaistackoverflow2024', date: 2023, type: 'UGC', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'Perplexity', aggregator: 'Multiple News Publishers', ref: 'perplexitymultiplenewspublishers2023', date: 2023, type: 'News', value: 'Undisclosed', codes: ['C', 'S', 'R'] },
  { receiver: 'Runway', aggregator: 'Getty Images', ref: 'runwaygetty2023', date: 2023, type: 'Images', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'Stability AI', aggregator: 'AudioSparx', ref: 'audiosparx2023', date: 2023, type: 'UGC', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'Stability AI', aggregator: 'Getty Images', ref: 'gettystabilityai2025', date: 2023, type: 'Images', value: 'Undisclosed', codes: ['L'] },
  { receiver: 'Microsoft', aggregator: 'Taylor & Francis / Informa', ref: 'microsofttf2024', date: 2024, type: 'Academic', value: '10m', codes: ['C'] },
  { receiver: 'Undisclosed', aggregator: 'HarperCollins', ref: 'undisclosedlargetechcompanyharpercollins2024', date: 2024, type: 'Academic', value: '2.5k/book', codes: ['C', 'S'] },
  { receiver: 'Undisclosed', aggregator: 'Reuters', ref: 'reuters2024', date: 2024, type: 'News', value: '22m', codes: ['C'] },
  { receiver: 'Amazon', aggregator: 'Shutterstock', ref: 'amazonshutterstock2024', date: 2024, type: 'Images', value: '25-50m', codes: ['C'] },
  { receiver: 'Apple', aggregator: 'Shutterstock', ref: 'appleshutterstock2024', date: 2024, type: 'Images', value: '25-50m', codes: ['C'] },
  { receiver: 'Google', aggregator: 'Shutterstock', ref: 'googleshutterstock2024', date: 2024, type: 'Images', value: '25-50m', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'Shutterstock', ref: 'openaishutterstock2024', date: 2024, type: 'Images', value: '25-50m', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'News Corp', ref: 'openainewscorp2024t', date: 2024, type: 'News', value: '250m/5yr', codes: ['C'] },
  { receiver: 'Perplexity', aggregator: 'Yelp', ref: 'perplexityyelp2024', date: 2024, type: 'UGC', value: '25m', codes: ['C'] },
  { receiver: 'Large Tech Company', aggregator: 'Wiley', ref: 'wiley2024', date: 2024, type: 'Academic', value: '44m', codes: ['C'] },
  { receiver: 'Google', aggregator: 'Reddit', ref: 'googlereddit2024t', date: 2024, type: 'UGC', value: '60m/yr', codes: ['C'] },
  { receiver: 'Undisclosed', aggregator: 'Taylor & Francis / Informa', ref: 'undisclosedtf2024', date: 2024, type: 'Academic', value: '65m', codes: ['C'] },
  { receiver: 'Undisclosed', aggregator: 'Freepik', ref: 'freepik2024', date: 2024, type: 'Images', value: '6m', codes: ['C'] },
  { receiver: 'Undisclosed', aggregator: 'Tempus', ref: 'multipleclientsundisclosedtempus2024', date: 2024, type: 'Health', value: '72.8m', codes: ['C', 'R'] },
  { receiver: 'Google', aggregator: 'StackOverflow', ref: 'googlestackoverflow2024t', date: 2024, type: 'UGC', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'Meta', aggregator: 'Reuters', ref: 'metareuters2024', date: 2024, type: 'News', value: 'Undisclosed', codes: ['C', 'U'] },
  { receiver: 'Midjourney', aggregator: 'Tumblr (Automattic)', ref: 'midjourneytumblr2024', date: 2024, type: 'UGC', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'Midjourney', aggregator: 'Wordpress', ref: 'midjourneywordpress2024', date: 2024, type: 'UGC', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'Musical AI', aggregator: 'Symphonic Distribution', ref: 'musicalaisymphonicdistribution2024', date: 2024, type: 'Audio', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'NVIDIA', aggregator: 'Shutterstock', ref: 'nvidiashutterstock2024', date: 2024, type: 'Images', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'Dotdash Meredith', ref: 'dotdashmeredith2024', date: 2024, type: 'News', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'TIME', ref: 'timedeal2024', date: 2024, type: 'News', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'NYT', ref: 'nytopenai2024', date: 2024, type: 'News', value: 'Undisclosed', codes: ['L'] },
  { receiver: 'OpenAI', aggregator: 'Reddit', ref: 'openaireddit2024', date: 2024, type: 'UGC', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'Tumblr (Automattic)', ref: 'openaitumblr2024', date: 2024, type: 'UGC', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'Vox Media', ref: 'voxmedia2024', date: 2024, type: 'News', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'Wordpress', ref: 'openaiwordpress2024', date: 2024, type: 'UGC', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'Le Monde', ref: 'openailemonde2024', date: 2024, type: 'News', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'Prisa Media', ref: 'openaiprisamedia2024', date: 2024, type: 'News', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'Financial Times', ref: 'openaifinancialtimes2024', date: 2024, type: 'News', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'The Atlantic', ref: 'openaitheatlantic2024', date: 2024, type: 'News', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'Condé Nast', ref: 'openaicondenast2024', date: 2024, type: 'News', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'Axios', ref: 'openaiaxios2024', date: 2024, type: 'News', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'The Guardian', ref: 'openaiguardian2024', date: 2024, type: 'News', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'Schibsted', ref: 'openaischibsted2024', date: 2024, type: 'News', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'Future plc', ref: 'openaifutureplc2024', date: 2024, type: 'News', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenAI', aggregator: 'Hearst Magazines', ref: 'openaihearstmagazines2024', date: 2024, type: 'News', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'Potato', aggregator: 'Wiley', ref: 'potatowiley2024', date: 2024, type: 'Academic', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'ProRata AI', aggregator: 'Multiple (500+) News Publishers', ref: 'prorataaimultiple500newspublishers2024', date: 2024, type: 'News', value: 'Undisclosed', codes: ['C', 'S'] },
  { receiver: 'Undisclosed', aggregator: 'Oxford University Press', ref: 'llmoxford2024', date: 2024, type: 'Academic', value: 'Undisclosed', codes: ['U'] },
  { receiver: 'Undisclosed', aggregator: 'Cambridge University Press', ref: 'cambridge2024', date: 2024, type: 'Academic', value: 'Undisclosed', codes: ['U'] },
  { receiver: 'Undisclosed', aggregator: 'Sage', ref: 'llmsage2024', date: 2024, type: 'Academic', value: 'Undisclosed', codes: ['U'] },
  { receiver: 'Amazon', aggregator: 'New York Times', ref: 'amazonnewyorktimes2025', date: 2025, type: 'News', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'AWS', aggregator: 'Wiley', ref: 'awswiley2025', date: 2025, type: 'Academic', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'Cohere', aggregator: 'News/Media Alliance', ref: 'newsalliancec2025', date: 2025, type: 'News', value: 'Undisclosed', codes: ['L'] },
  { receiver: 'Google', aggregator: 'Associated Press', ref: 'googleassociatedpress2025', date: 2025, type: 'News', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'Mistral AI', aggregator: 'Agence France-Presse', ref: 'mistralaiagencefrancepresse2025', date: 2025, type: 'News', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'OpenEvidence', aggregator: 'NEJM Group', ref: 'openevidence2025', date: 2025, type: 'Academic', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'Perplexity', aggregator: 'Wiley', ref: 'perplexitywiley2025', date: 2025, type: 'Academic', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'Pinterest', aggregator: 'Pinterest Users', ref: 'pinterest2025t', date: 2025, type: 'Images', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'ProRata', aggregator: 'AAAS', ref: 'prorata2025', date: 2025, type: 'Academic', value: 'Undisclosed', codes: ['C'] },
  { receiver: 'Undisclosed', aggregator: 'De Gruyter Brill', ref: 'degruyter2025', date: 2025, type: 'Academic', value: 'Undisclosed', codes: ['U'] },
  { receiver: 'Undisclosed', aggregator: 'DataSeeds AI (Zedge)', ref: 'undiscloseddataseedsaizedge2025', date: 2025, type: 'Images', value: 'Undisclosed', codes: ['C'] },
];

// Process deals and add parsed values
const deals = rawDeals.map((deal, index) => {
  const parsedValue = parseValue(deal.value);
  return {
    id: index + 1,
    data_receiver: deal.receiver,
    data_aggregator: deal.aggregator,
    ref: deal.ref,
    date: deal.date,
    type: deal.type,
    ...parsedValue,
    codes: deal.codes
  };
});

// Write to JSON file
const outputPath = path.join(__dirname, '..', 'data', 'deals.json');
fs.writeFileSync(outputPath, JSON.stringify(deals, null, 2));
console.log(`Extracted ${deals.length} deals to ${outputPath}`);

